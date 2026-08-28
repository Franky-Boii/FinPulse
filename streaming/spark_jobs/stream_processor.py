"""
FinPulse — speed layer.

Consumes Debezium CDC events for `payments` and `order_items` off
Redpanda (Kafka API), computes low-latency windowed aggregates, and
publishes them to two places:

  1. Redis        -> sub-millisecond reads for the FastAPI /realtime endpoints
  2. postgres-warehouse.realtime.* -> a durable, queryable copy of the
     same aggregates

The batch layer, run nightly by Airflow + dbt, remains the source of truth.
This streaming layer exists to close the latency gap until the next batch
run lands.
"""

import os

import redis

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType,
    StructField,
    StringType,
    IntegerType,
    DoubleType,
)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

KAFKA_BOOTSTRAP = os.environ.get(
    "KAFKA_BOOTSTRAP",
    "redpanda:29092",
)

REDIS_HOST = os.environ.get(
    "REDIS_HOST",
    "redis",
)

WAREHOUSE_JDBC_URL = (
    "jdbc:postgresql://postgres-warehouse:5432/warehouse"
)

WAREHOUSE_JDBC_PROPS = {
    "user": "finpulse",
    "password": "finpulse",
    "driver": "org.postgresql.Driver",
}

PAYMENTS_TOPIC = "finpulse.public.payments"

ORDER_ITEMS_TOPIC = "finpulse.public.order_items"

PRODUCTS_JDBC_TABLE = "public.products"

SOURCE_JDBC_URL = (
    "jdbc:postgresql://postgres-source:5432/ecommerce"
)

SOURCE_JDBC_PROPS = {
    "user": "finpulse",
    "password": "finpulse",
    "driver": "org.postgresql.Driver",
}


# ---------------------------------------------------------------------------
# Spark
# ---------------------------------------------------------------------------

def build_spark():
    return (
        SparkSession.builder
        .appName("finpulse-speed-layer")
        .config("spark.sql.shuffle.partitions", "4")
        .getOrCreate()
    )


# ---------------------------------------------------------------------------
# Debezium schemas
# ---------------------------------------------------------------------------

PAYMENT_AFTER_SCHEMA = StructType([
    StructField("payment_id", IntegerType()),
    StructField("order_id", IntegerType()),
    StructField("amount", DoubleType()),
    StructField("payment_method", StringType()),
    StructField("payment_status", StringType()),
    StructField("paid_at", StringType()),
    StructField("created_at", StringType()),
])


ORDER_ITEM_AFTER_SCHEMA = StructType([
    StructField("order_item_id", IntegerType()),
    StructField("order_id", IntegerType()),
    StructField("product_id", IntegerType()),
    StructField("quantity", IntegerType()),
    StructField("unit_price", DoubleType()),
    StructField("line_total", DoubleType()),
    StructField("created_at", StringType()),
])


def debezium_envelope(after_schema):
    return StructType([
        StructField("before", after_schema),
        StructField("after", after_schema),
        StructField("op", StringType()),
        StructField("ts_ms", DoubleType()),
    ])


# ---------------------------------------------------------------------------
# Kafka / Debezium CDC reader
# ---------------------------------------------------------------------------

def read_cdc_stream(spark, topic, after_schema):

    envelope_schema = debezium_envelope(after_schema)

    raw = (
        spark.readStream
        .format("kafka")
        .option(
            "kafka.bootstrap.servers",
            KAFKA_BOOTSTRAP,
        )
        .option(
            "subscribe",
            topic,
        )
        .option(
            "startingOffsets",
            "earliest",
        )
        .option(
            "failOnDataLoss",
            "false",
        )
        .load()
    )

    parsed = raw.select(
        F.from_json(
            F.col("value").cast("string"),
            envelope_schema,
        ).alias("envelope")
    )

    return parsed.select(
        "envelope.op",
        "envelope.after",
    )


# ---------------------------------------------------------------------------
# PostgreSQL UPSERT helper
# ---------------------------------------------------------------------------

def upsert_dataframe_to_postgres(
    df,
    table_name,
    conflict_columns,
    update_columns,
):
    """
    Write a Spark DataFrame to PostgreSQL using INSERT ... ON CONFLICT.

    Spark's normal JDBC .mode("append") performs plain INSERT statements.
    That is not sufficient for our realtime tables because a later
    micro-batch can contain the same window.

    This helper writes each row through PostgreSQL's upsert mechanism.
    """

    rows = df.collect()

    if not rows:
        return

    import psycopg2

    conn = psycopg2.connect(
        host="postgres-warehouse",
        port=5432,
        dbname="warehouse",
        user="finpulse",
        password="finpulse",
    )

    try:
        cursor = conn.cursor()

        columns = df.columns

        column_sql = ", ".join(
            f'"{column}"'
            for column in columns
        )

        placeholders = ", ".join(
            ["%s"] * len(columns)
        )

        conflict_sql = ", ".join(
            f'"{column}"'
            for column in conflict_columns
        )

        update_sql = ", ".join(
            f'"{column}" = EXCLUDED."{column}"'
            for column in update_columns
        )

        sql = f"""
            INSERT INTO {table_name}
            ({column_sql})
            VALUES ({placeholders})
            ON CONFLICT ({conflict_sql})
            DO UPDATE SET
                {update_sql}
        """

        for row in rows:
            values = [
                row[column]
                for column in columns
            ]

            cursor.execute(
                sql,
                values,
            )

        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


# ---------------------------------------------------------------------------
# Revenue by minute
# ---------------------------------------------------------------------------

def write_revenue_by_minute(batch_df, batch_id):

    if batch_df.rdd.isEmpty():
        return

    # -----------------------------------------------------------------------
    # Aggregate the micro-batch
    # -----------------------------------------------------------------------

    agg_df = (
        batch_df
        .groupBy("window_start")
        .agg(
            F.countDistinct(
                "order_id"
            ).alias("order_count"),

            F.coalesce(
                F.sum("amount"),
                F.lit(0.0),
            ).alias("revenue"),
        )
    )

    if agg_df.rdd.isEmpty():
        return

    # -----------------------------------------------------------------------
    # Redis
    # -----------------------------------------------------------------------

    agg = agg_df.collect()

    r = redis.Redis(
        host=REDIS_HOST,
        port=6379,
        decode_responses=True,
    )

    for row in agg:

        window_start_iso = (
            row["window_start"].isoformat()
        )

        order_count = (
            row["order_count"] or 0
        )

        revenue = float(
            row["revenue"] or 0.0
        )

        r.hset(
            "finpulse:realtime:revenue:latest",
            mapping={
                "window_start": window_start_iso,
                "order_count": order_count,
                "revenue": revenue,
            },
        )

        r.zadd(
            "finpulse:realtime:revenue:series",
            {
                window_start_iso: order_count
            },
        )

    # -----------------------------------------------------------------------
    # PostgreSQL
    #
    # Primary key:
    #
    #   window_start
    #
    # Therefore this is an UPSERT.
    # -----------------------------------------------------------------------

    upsert_dataframe_to_postgres(
        df=agg_df,
        table_name="realtime.revenue_by_minute_staging",
        conflict_columns=[
            "window_start"
        ],
        update_columns=[
            "order_count",
            "revenue",
        ],
    )


# ---------------------------------------------------------------------------
# Top products
# ---------------------------------------------------------------------------

def write_top_products(batch_df, batch_id):

    if batch_df.rdd.isEmpty():
        return

    # -----------------------------------------------------------------------
    # Protect against NULL line_total
    #
    # Priority:
    #
    #   1. line_total
    #   2. quantity * unit_price
    #   3. 0.0
    #
    # This guarantees revenue is never NULL.
    # -----------------------------------------------------------------------

    safe_batch_df = (
        batch_df
        .withColumn(
            "safe_line_total",
            F.coalesce(
                F.col("line_total"),
                F.col("quantity") * F.col("unit_price"),
                F.lit(0.0),
            ),
        )
    )

    # -----------------------------------------------------------------------
    # Aggregate
    # -----------------------------------------------------------------------

    agg_df = (
        safe_batch_df
        .groupBy(
            "window_start",
            "product_id",
            "product_name",
        )
        .agg(
            F.coalesce(
                F.sum("quantity"),
                F.lit(0),
            ).cast("int").alias("units_sold"),

            F.coalesce(
                F.sum("safe_line_total"),
                F.lit(0.0),
            ).alias("revenue"),
        )
    )

    if agg_df.rdd.isEmpty():
        return

    # -----------------------------------------------------------------------
    # Redis
    # -----------------------------------------------------------------------

    redis_top_products = (
        agg_df
        .orderBy(
            F.desc("revenue")
        )
        .limit(20)
        .collect()
    )

    r = redis.Redis(
        host=REDIS_HOST,
        port=6379,
        decode_responses=True,
    )

    r.delete(
        "finpulse:realtime:top_products"
    )

    for row in redis_top_products:

        product_name = row["product_name"]

        if product_name is None:
            product_name = (
                f"product-{row['product_id']}"
            )

        revenue = float(
            row["revenue"] or 0.0
        )

        r.zadd(
            "finpulse:realtime:top_products",
            {
                product_name: revenue
            },
        )

    # -----------------------------------------------------------------------
    # PostgreSQL
    #
    # Primary key:
    #
    #   (window_start, product_id)
    #
    # Therefore this is an UPSERT.
    # -----------------------------------------------------------------------

    upsert_dataframe_to_postgres(
        df=agg_df,
        table_name="realtime.top_products_5min",
        conflict_columns=[
            "window_start",
            "product_id",
        ],
        update_columns=[
            "product_name",
            "units_sold",
            "revenue",
        ],
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():

    spark = build_spark()

    spark.sparkContext.setLogLevel(
        "WARN"
    )

    # =======================================================================
    # PAYMENTS STREAM
    # =======================================================================

    payments = read_cdc_stream(
        spark,
        PAYMENTS_TOPIC,
        PAYMENT_AFTER_SCHEMA,
    )

    successful_payments = (
        payments
        .filter(
            (
                F.col("op").isin(
                    "c",
                    "u",
                )
            )
            &
            (
                F.col(
                    "after.payment_status"
                ) == "success"
            )
        )
        .select(
            F.col(
                "after.order_id"
            ).alias("order_id"),

            F.coalesce(
                F.col("after.amount"),
                F.lit(0.0),
            ).alias("amount"),

            F.to_timestamp(
                F.col("after.paid_at")
            ).alias("event_time"),
        )
        .withColumn(
            "event_time",
            F.coalesce(
                F.col("event_time"),
                F.current_timestamp(),
            ),
        )
        .withWatermark(
            "event_time",
            "2 minutes",
        )
        .withColumn(
            "window_start",
            F.window(
                F.col("event_time"),
                "1 minute",
            ).getField("start"),
        )
    )

    revenue_query = (
        successful_payments
        .writeStream
        .foreachBatch(
            write_revenue_by_minute
        )
        .outputMode("append")
        .option(
            "checkpointLocation",
            "/tmp/checkpoints/revenue_by_minute",
        )
        .trigger(
            processingTime="15 seconds"
        )
        .start()
    )

    # =======================================================================
    # ORDER ITEMS STREAM
    # =======================================================================

    order_items = read_cdc_stream(
        spark,
        ORDER_ITEMS_TOPIC,
        ORDER_ITEM_AFTER_SCHEMA,
    )

    items_created = (
        order_items
        .filter(
            F.col("op") == "c"
        )
        .select(
            F.col(
                "after.product_id"
            ).alias("product_id"),

            F.coalesce(
                F.col("after.quantity"),
                F.lit(0),
            ).alias("quantity"),

            F.col(
                "after.unit_price"
            ).alias("unit_price"),

            F.col(
                "after.line_total"
            ).alias("line_total"),

            F.to_timestamp(
                F.col("after.created_at")
            ).alias("event_time"),
        )
        .withWatermark(
            "event_time",
            "2 minutes",
        )
        .withColumn(
            "window_start",
            F.window(
                F.col("event_time"),
                "5 minutes",
            ).getField("start"),
        )
    )

    # =======================================================================
    # LOAD STATIC PRODUCTS
    # =======================================================================

    products_static = (
        spark.read.jdbc(
            url=SOURCE_JDBC_URL,
            table=PRODUCTS_JDBC_TABLE,
            properties=SOURCE_JDBC_PROPS,
        )
        .select(
            "product_id",
            "product_name",
        )
    )

    # =======================================================================
    # JOIN ORDER ITEMS WITH PRODUCT NAMES
    # =======================================================================

    items_with_names = (
        items_created
        .join(
            F.broadcast(
                products_static
            ),
            on="product_id",
            how="left",
        )
    )

    # =======================================================================
    # TOP PRODUCTS STREAM
    # =======================================================================

    top_products_query = (
        items_with_names
        .writeStream
        .foreachBatch(
            write_top_products
        )
        .outputMode("append")
        .option(
            "checkpointLocation",
            "/tmp/checkpoints/top_products",
        )
        .trigger(
            processingTime="15 seconds"
        )
        .start()
    )

    # =======================================================================
    # WAIT
    # =======================================================================

    spark.streams.awaitAnyTermination()


if __name__ == "__main__":
    main()

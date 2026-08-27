"""
FinPulse — speed layer.

Consumes Debezium CDC events for `payments` and `order_items` off
Redpanda (Kafka API), computes low-latency windowed aggregates, and
publishes them to two places:

  1. Redis        -> sub-millisecond reads for the FastAPI /realtime endpoints
  2. postgres-warehouse.realtime.* -> a durable, queryable copy of the
     same aggregates (so they survive a Redis restart and can be
     joined against in SQL if needed)

This is deliberately kept simpler and less rigorously modeled than the
batch/dbt layer — that asymmetry (fast + approximate vs. slow +
authoritative) is the whole point of a Lambda architecture. The batch
layer, run nightly by Airflow + dbt, is the source of truth; this layer
exists purely to close the latency gap until the next batch run lands.
"""

import os
import json

import redis
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, DoubleType, TimestampType
)

KAFKA_BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP", "redpanda:29092")
REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
WAREHOUSE_DB_URI = os.environ.get(
    "WAREHOUSE_DB_URI", "postgresql://finpulse:finpulse@postgres-warehouse:5432/warehouse"
)
WAREHOUSE_JDBC_URL = "jdbc:postgresql://postgres-warehouse:5432/warehouse"
WAREHOUSE_JDBC_PROPS = {"user": "finpulse", "password": "finpulse", "driver": "org.postgresql.Driver"}

PAYMENTS_TOPIC = "finpulse.public.payments"
ORDER_ITEMS_TOPIC = "finpulse.public.order_items"
PRODUCTS_JDBC_TABLE = "public.products"
SOURCE_JDBC_URL = "jdbc:postgresql://postgres-source:5432/ecommerce"
SOURCE_JDBC_PROPS = {"user": "finpulse", "password": "finpulse", "driver": "org.postgresql.Driver"}


def build_spark():
    return (
        SparkSession.builder.appName("finpulse-speed-layer")
        .config("spark.sql.shuffle.partitions", "4")
        .getOrCreate()
    )


PAYMENT_AFTER_SCHEMA = StructType([
    StructField("payment_id", IntegerType()),
    StructField("order_id", IntegerType()),
    StructField("amount", DoubleType()),
    StructField("payment_method", StringType()),
    StructField("payment_status", StringType()),
    StructField("paid_at", StringType()),  # ISO string; cast below
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

DEBEZIUM_ENVELOPE = lambda after_schema: StructType([
    StructField("before", after_schema),
    StructField("after", after_schema),
    StructField("op", StringType()),
    StructField("ts_ms", DoubleType()),
])


def read_cdc_stream(spark, topic, after_schema):
    envelope_schema = DEBEZIUM_ENVELOPE(after_schema)
    raw = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
        .option("subscribe", topic)
        .option("startingOffsets", "earliest")
        .option("failOnDataLoss", "false")
        .load()
    )
    parsed = raw.select(
        F.from_json(F.col("value").cast("string"), envelope_schema).alias("envelope")
    )
    return parsed.select("envelope.op", "envelope.after")


def write_revenue_by_minute(batch_df, batch_id):
    if batch_df.rdd.isEmpty():
        return

    agg = (
        batch_df.groupBy("window_start")
        .agg(
            F.countDistinct("order_id").alias("order_count"),
            F.sum("amount").alias("revenue"),
        )
        .collect()
    )
    if not agg:
        return

    r = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)
    for row in agg:
        window_start_iso = row["window_start"].isoformat()
        r.hset(
            "finpulse:realtime:revenue:latest",
            mapping={
                "window_start": window_start_iso,
                "order_count": row["order_count"],
                "revenue": float(row["revenue"] or 0),
            },
        )
        r.zadd("finpulse:realtime:revenue:series", {window_start_iso: row["order_count"]})

    (
        batch_df.groupBy("window_start")
        .agg(
            F.countDistinct("order_id").alias("order_count"),
            F.sum("amount").alias("revenue"),
        )
        .write.format("jdbc")
        .option("url", WAREHOUSE_JDBC_URL)
        .option("dbtable", "realtime.revenue_by_minute_staging")
        .options(**WAREHOUSE_JDBC_PROPS)
        .mode("append")
        .save()
    )


def write_top_products(batch_df, batch_id):
    if batch_df.rdd.isEmpty():
        return

    agg = (
        batch_df.groupBy("window_start", "product_id", "product_name")
        .agg(
            F.sum("quantity").alias("units_sold"),
            F.sum("line_total").alias("revenue"),
        )
        .orderBy(F.desc("revenue"))
        .limit(20)
        .collect()
    )
    if not agg:
        return

    r = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)
    r.delete("finpulse:realtime:top_products")
    for row in agg:
        r.zadd("finpulse:realtime:top_products", {row["product_name"]: float(row["revenue"] or 0)})

    (
        batch_df.groupBy("window_start", "product_id", "product_name")
        .agg(
            F.sum("quantity").alias("units_sold"),
            F.sum("line_total").alias("revenue"),
        )
        .write.format("jdbc")
        .option("url", WAREHOUSE_JDBC_URL)
        .option("dbtable", "realtime.top_products_5min")
        .options(**WAREHOUSE_JDBC_PROPS)
        .mode("append")
        .save()
    )


def main():
    spark = build_spark()
    spark.sparkContext.setLogLevel("WARN")

    # ---- Payments stream -> revenue_by_minute -------------------------
    payments = read_cdc_stream(spark, PAYMENTS_TOPIC, PAYMENT_AFTER_SCHEMA)
    successful_payments = (
        payments.filter((F.col("op").isin("c", "u")) & (F.col("after.payment_status") == "success"))
        .select(
            F.col("after.order_id").alias("order_id"),
            F.col("after.amount").alias("amount"),
            F.to_timestamp(F.col("after.paid_at")).alias("event_time"),
        )
        .withColumn("event_time", F.coalesce(F.col("event_time"), F.current_timestamp()))
        .withWatermark("event_time", "2 minutes")
        .withColumn("window_start", F.window(F.col("event_time"), "1 minute").getField("start"))
    )

    revenue_query = (
        successful_payments.writeStream.foreachBatch(write_revenue_by_minute)
        .outputMode("append")
        .option("checkpointLocation", "/tmp/checkpoints/revenue_by_minute")
        .trigger(processingTime="15 seconds")
        .start()
    )

    # ---- Order items stream (joined with static products) -------------
    order_items = read_cdc_stream(spark, ORDER_ITEMS_TOPIC, ORDER_ITEM_AFTER_SCHEMA)
    items_created = (
        order_items.filter(F.col("op") == "c")
        .select(
            F.col("after.product_id").alias("product_id"),
            F.col("after.quantity").alias("quantity"),
            F.col("after.line_total").alias("line_total"),
            F.to_timestamp(F.col("after.created_at")).alias("event_time"),
        )
        .withWatermark("event_time", "2 minutes")
        .withColumn("window_start", F.window(F.col("event_time"), "5 minutes").getField("start"))
    )

    products_static = spark.read.jdbc(
        url=SOURCE_JDBC_URL, table=PRODUCTS_JDBC_TABLE, properties=SOURCE_JDBC_PROPS
    ).select("product_id", "product_name")

    items_with_names = items_created.join(F.broadcast(products_static), on="product_id", how="left")

    top_products_query = (
        items_with_names.writeStream.foreachBatch(write_top_products)
        .outputMode("append")
        .option("checkpointLocation", "/tmp/checkpoints/top_products")
        .trigger(processingTime="15 seconds")
        .start()
    )

    spark.streams.awaitAnyTermination()


if __name__ == "__main__":
    main()
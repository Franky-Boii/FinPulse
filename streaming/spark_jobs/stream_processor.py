from __future__ import annotations

from pyspark.sql import SparkSession
from pyspark.sql import functions as F


def build_spark_session() -> SparkSession:
    return (
        SparkSession.builder.appName("FinPulseStreamProcessor")
        .config("spark.sql.shuffle.partitions", "2")
        .getOrCreate()
    )


def main() -> None:
    spark = build_spark_session()

    # Placeholder for the real FinPulse speed-layer pipeline.
    # This project expects Kafka CDC topics from Debezium, followed by
    # windowed aggregations and Redis/Postgres outputs.
    spark.stop()


if __name__ == "__main__":
    main()

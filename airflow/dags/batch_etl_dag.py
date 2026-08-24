"""
FinPulse — batch layer DAG.

This is the "batch layer" of the Lambda architecture: it periodically
re-derives the complete, authoritative view of the business from the
full history of source data. It is slower than the Spark speed layer
but correct-by-construction — if the two ever disagree, the batch
layer wins.

Steps:
    1. extract_source_to_raw   — EL: full extract of the OLTP tables
                                   into warehouse.raw (pandas + SQLAlchemy)
    2. dbt_seed                — load reference/lookup data
    3. dbt_run                 — T: staging -> marts transformations
    4. dbt_test                — data quality gate (schema + relationship
                                   + accepted-value tests)
    5. compact_realtime_layer  — dedupe the Spark speed layer's
                                   append-only staging table into the
                                   queryable realtime.revenue_by_minute
                                   table (keeps the speed layer's own
                                   storage from growing unbounded)
"""

from __future__ import annotations

import os
import pendulum
import pandas as pd
from sqlalchemy import create_engine, text

from airflow.decorators import dag, task
from airflow.operators.bash import BashOperator

SOURCE_DB_URI = os.environ.get(
    "FINPULSE_SOURCE_DB_URI", "postgresql+psycopg2://finpulse:finpulse@postgres-source:5432/ecommerce"
)
WAREHOUSE_DB_URI = os.environ.get(
    "FINPULSE_WAREHOUSE_DB_URI", "postgresql+psycopg2://finpulse:finpulse@postgres-warehouse:5432/warehouse"
)

SOURCE_TABLES = ["customers", "products", "orders", "order_items", "payments"]

DBT_PROJECT_DIR = "/opt/dbt/finpulse"
DBT_PROFILES_DIR = "/opt/dbt"


@dag(
    dag_id="finpulse_batch_etl",
    description="Batch layer: extract OLTP -> raw, transform via dbt, test, compact realtime layer",
    schedule="@hourly",
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    catchup=False,
    tags=["finpulse", "batch", "lambda-architecture"],
)
def finpulse_batch_etl():

    @task
    def extract_source_to_raw():
        """Full-table extract from the OLTP source into warehouse.raw.
        A real production system would do this incrementally (CDC-fed
        or watermark-based); a full extract keeps the batch layer
        simple to reason about and is cheap at this data volume."""
        source_engine = create_engine(SOURCE_DB_URI)
        warehouse_engine = create_engine(WAREHOUSE_DB_URI)

        row_counts = {}
        for table in SOURCE_TABLES:
            df = pd.read_sql_table(table, source_engine, schema="public")
            df.to_sql(
                table,
                warehouse_engine,
                schema="raw",
                if_exists="replace",
                index=False,
            )
            row_counts[table] = len(df)
        return row_counts

    @task
    def compact_realtime_layer():
        """Dedupe the Spark job's append-only staging landing table
        down to one row per minute window in the queryable realtime
        table, and truncate the staging table."""
        engine = create_engine(WAREHOUSE_DB_URI)
        with engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO realtime.revenue_by_minute (window_start, order_count, revenue, updated_at)
                SELECT DISTINCT ON (window_start)
                    window_start, order_count, revenue, now()
                FROM realtime.revenue_by_minute_staging
                ORDER BY window_start, ingested_at DESC
                ON CONFLICT (window_start) DO UPDATE
                    SET order_count = EXCLUDED.order_count,
                        revenue = EXCLUDED.revenue,
                        updated_at = now()
            """))
            conn.execute(text("TRUNCATE realtime.revenue_by_minute_staging"))

    dbt_seed = BashOperator(
        task_id="dbt_seed",
        bash_command=f"cd {DBT_PROJECT_DIR} && dbt seed --profiles-dir {DBT_PROFILES_DIR}",
    )

    dbt_run = BashOperator(
        task_id="dbt_run",
        bash_command=f"cd {DBT_PROJECT_DIR} && dbt run --profiles-dir {DBT_PROFILES_DIR}",
    )

    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command=f"cd {DBT_PROJECT_DIR} && dbt test --profiles-dir {DBT_PROFILES_DIR}",
    )

    extracted = extract_source_to_raw()
    extracted >> dbt_seed >> dbt_run >> dbt_test >> compact_realtime_layer()


finpulse_batch_etl()

"""
FinPulse — batch layer DAG.

This is the "batch layer" of the Lambda architecture: it periodically
re-derives the complete, authoritative view of the business from the
full history of source data. It is slower than the Spark speed layer
but correct-by-construction — if the two ever disagree, the batch
layer wins.

Steps:
    1. extract_source_to_raw   — EL: full extract of the OLTP tables
                                   into warehouse.raw (via SQLAlchemy
                                   Core — see note below on why not
                                   pandas.read_sql_table/to_sql)
    2. dbt_seed                — load reference/lookup data
    3. dbt_run                 — T: staging -> marts transformations
    4. dbt_test                — data quality gate (schema + relationship
                                   + accepted-value tests)
    5. compact_realtime_layer  — dedupe the Spark speed layer's
                                   append-only staging table into the
                                   queryable realtime.revenue_by_minute
                                   table (keeps the speed layer's own
                                   storage from growing unbounded)

Note on extract_source_to_raw: this deliberately avoids
pandas.read_sql_table/to_sql. As of pandas 2.2.x there is an
unresolved pandas bug (pandas-dev/pandas#57053) where its internal
has_table() check crashes with "'Engine' object has no attribute
'cursor'" on a live SQLAlchemy engine/connection, independent of the
SQLAlchemy version installed. Using SQLAlchemy Core directly for the
extract/load sidesteps that bug entirely and is arguably the more
correct tool for an EL step anyway.
"""

from __future__ import annotations

import os
import pendulum
from sqlalchemy import create_engine, text, MetaData, Table, insert

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
        """Full-table extract from the OLTP source into warehouse.raw,
        using SQLAlchemy Core directly (see module docstring for why
        not pandas). A real production system would do this
        incrementally (CDC-fed or watermark-based); a full extract
        keeps the batch layer simple to reason about and is cheap at
        this data volume."""
        source_engine = create_engine(SOURCE_DB_URI)
        warehouse_engine = create_engine(WAREHOUSE_DB_URI)

        source_meta = MetaData()
        warehouse_meta = MetaData(schema="raw")

        row_counts = {}
        with source_engine.connect() as src_conn, warehouse_engine.begin() as wh_conn:
            for table_name in SOURCE_TABLES:
                src_table = Table(
                    table_name, source_meta, schema="public", autoload_with=source_engine
                )

                # Full-refresh EL: drop and recreate the raw copy each run.
                wh_conn.execute(text(f'DROP TABLE IF EXISTS raw."{table_name}"'))
                wh_table = src_table.to_metadata(warehouse_meta, schema="raw")
                wh_table.create(bind=wh_conn)

                # Generated/computed columns (e.g. order_items.line_total)
                # can't be explicitly inserted into on Postgres — Postgres
                # (re)computes them itself from the other column values.
                insertable_cols = {c.name for c in wh_table.columns if c.computed is None}

                rows = [
                    {k: v for k, v in dict(row._mapping).items() if k in insertable_cols}
                    for row in src_conn.execute(src_table.select())
                ]
                if rows:
                    wh_conn.execute(insert(wh_table), rows)
                row_counts[table_name] = len(rows)

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

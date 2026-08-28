"""
FinPulse — Batch Layer DAG

The batch layer periodically rebuilds the authoritative analytical
representation of the OLTP source.

Pipeline:

    PostgreSQL OLTP
          |
          v
    raw warehouse schema
          |
          v
       dbt seed
          |
          v
       dbt run
          |
          v
      dbt test
          |
          v
    realtime compaction

The batch layer is intentionally simple in this version of FinPulse.

The source tables are fully extracted into the raw schema on each run.
This gives us a deterministic baseline that is easy to understand and
debug.

A future production-oriented iteration can replace the full extraction
with an incremental/watermark-based strategy.
"""

from __future__ import annotations

import os

import pendulum
from airflow.decorators import dag, task
from airflow.operators.bash import BashOperator
from sqlalchemy import MetaData, Table, create_engine, insert, text


SOURCE_DB_URI = os.environ.get(
    "FINPULSE_SOURCE_DB_URI",
    "postgresql+psycopg2://finpulse:finpulse@postgres-source:5432/ecommerce",
)

WAREHOUSE_DB_URI = os.environ.get(
    "FINPULSE_WAREHOUSE_DB_URI",
    "postgresql+psycopg2://finpulse:finpulse@postgres-warehouse:5432/warehouse",
)

SOURCE_TABLES = [
    "customers",
    "products",
    "orders",
    "order_items",
    "payments",
]

DBT_PROJECT_DIR = "/opt/dbt/finpulse"

DBT_PROFILES_DIR = os.environ.get(
    "DBT_PROFILES_DIR",
    "/opt/dbt",
)


@dag(
    dag_id="finpulse_batch_etl",
    description=(
        "FinPulse batch layer: "
        "extract OLTP -> raw -> dbt -> tests -> realtime compaction"
    ),
    schedule="@hourly",
    start_date=pendulum.datetime(
        2026,
        1,
        1,
        tz="UTC",
    ),
    catchup=False,
    tags=[
        "finpulse",
        "batch",
        "etl",
        "dbt",
        "lambda-architecture",
    ],
)
def finpulse_batch_etl():

    @task
    def extract_source_to_raw():
        """
        Perform a full extract of the OLTP source tables into
        warehouse.raw.

        SQLAlchemy Core is used directly rather than pandas.read_sql_table
        or pandas.to_sql.

        This also handles PostgreSQL generated columns correctly by
        excluding computed columns from INSERT statements.
        """

        source_engine = create_engine(
            SOURCE_DB_URI,
            pool_pre_ping=True,
        )

        warehouse_engine = create_engine(
            WAREHOUSE_DB_URI,
            pool_pre_ping=True,
        )

        source_metadata = MetaData()

        row_counts: dict[str, int] = {}

        try:
            with source_engine.connect() as source_conn:
                with warehouse_engine.begin() as warehouse_conn:

                    for table_name in SOURCE_TABLES:

                        source_table = Table(
                            table_name,
                            source_metadata,
                            schema="public",
                            autoload_with=source_engine,
                        )

                        # -------------------------------------------------
                        # Drop the existing raw table.
                        # -------------------------------------------------

                        warehouse_conn.execute(
                            text(
                                f'DROP TABLE IF EXISTS raw."{table_name}"'
                            )
                        )

                        # -------------------------------------------------
                        # Recreate the raw table using the source schema.
                        # -------------------------------------------------

                        warehouse_metadata = MetaData(
                            schema="raw"
                        )

                        warehouse_table = source_table.to_metadata(
                            warehouse_metadata,
                            schema="raw",
                        )

                        warehouse_table.create(
                            bind=warehouse_conn
                        )

                        # -------------------------------------------------
                        # Generated/computed columns must not be included
                        # in INSERT statements.
                        #
                        # Example:
                        #
                        # order_items.line_total
                        #
                        # PostgreSQL calculates this automatically.
                        # -------------------------------------------------

                        insertable_columns = {
                            column.name
                            for column in warehouse_table.columns
                            if column.computed is None
                        }

                        rows = []

                        result = source_conn.execute(
                            source_table.select()
                        )

                        for row in result:
                            mapped_row = dict(row._mapping)

                            filtered_row = {
                                key: value
                                for key, value in mapped_row.items()
                                if key in insertable_columns
                            }

                            rows.append(filtered_row)

                        # -------------------------------------------------
                        # Bulk insert into raw.
                        # -------------------------------------------------

                        if rows:
                            warehouse_conn.execute(
                                insert(warehouse_table),
                                rows,
                            )

                        row_counts[table_name] = len(rows)

        finally:
            source_engine.dispose()
            warehouse_engine.dispose()

        return row_counts

    @task
    def compact_realtime_layer():
        """
        Compact Spark's append-only revenue staging table.

        The Spark streaming job writes multiple rows for a window.
        This task keeps the queryable realtime table at one row per
        minute window.
        """

        engine = create_engine(
            WAREHOUSE_DB_URI,
            pool_pre_ping=True,
        )

        try:
            with engine.begin() as conn:

                conn.execute(
                    text(
                        """
                        INSERT INTO realtime.revenue_by_minute (
                            window_start,
                            order_count,
                            revenue,
                            updated_at
                        )
                        SELECT DISTINCT ON (window_start)
                            window_start,
                            order_count,
                            revenue,
                            NOW()
                        FROM realtime.revenue_by_minute_staging
                        ORDER BY
                            window_start,
                            ingested_at DESC

                        ON CONFLICT (window_start)
                        DO UPDATE SET
                            order_count = EXCLUDED.order_count,
                            revenue = EXCLUDED.revenue,
                            updated_at = NOW()
                        """
                    )
                )

                conn.execute(
                    text(
                        """
                        TRUNCATE TABLE
                            realtime.revenue_by_minute_staging
                        """
                    )
                )

        finally:
            engine.dispose()

    dbt_seed = BashOperator(
        task_id="dbt_seed",
        bash_command=(
            f"cd {DBT_PROJECT_DIR} && "
            f"dbt seed --profiles-dir {DBT_PROFILES_DIR}"
        ),
    )

    dbt_run = BashOperator(
        task_id="dbt_run",
        bash_command=(
            f"cd {DBT_PROJECT_DIR} && "
            f"dbt run --profiles-dir {DBT_PROFILES_DIR}"
        ),
    )

    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command=(
            f"cd {DBT_PROJECT_DIR} && "
            f"dbt test --profiles-dir {DBT_PROFILES_DIR}"
        ),
    )

    extracted = extract_source_to_raw()

    extracted >> dbt_seed >> dbt_run >> dbt_test >> compact_realtime_layer()


finpulse_batch_etl()
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
This provides a deterministic baseline that is easy to understand and
debug.

The raw tables themselves are preserved between runs because downstream
dbt staging and monitoring views depend on them. Existing raw data is
TRUNCATED before each full reload.

A future production-oriented iteration can replace the full extraction
with an incremental/watermark-based strategy.

Monitoring:

    Airflow DAG
          |
          +--> SUCCESS callback
          |
          +--> FAILURE callback
          |
          v
    monitoring.pipeline_runs

The monitoring table records the outcome of each batch pipeline run so
that pipeline health can later be exposed through FastAPI and the
FinPulse dashboard.
"""

from __future__ import annotations

import os

import pendulum
from airflow.decorators import dag, task
from airflow.operators.bash import BashOperator
from sqlalchemy import (
    ForeignKeyConstraint,
    MetaData,
    Table,
    create_engine,
    insert,
    text,
)


# =====================================================================
# DATABASE CONFIGURATION
# =====================================================================

SOURCE_DB_URI = os.environ.get(
    "FINPULSE_SOURCE_DB_URI",
    "postgresql+psycopg2://finpulse:finpulse@postgres-source:5432/ecommerce",
)

WAREHOUSE_DB_URI = os.environ.get(
    "FINPULSE_WAREHOUSE_DB_URI",
    "postgresql+psycopg2://finpulse:finpulse@postgres-warehouse:5432/warehouse",
)


# =====================================================================
# SOURCE TABLE CONFIGURATION
# =====================================================================

SOURCE_TABLES = [
    "customers",
    "products",
    "orders",
    "order_items",
    "payments",
]


# =====================================================================
# DBT CONFIGURATION
# =====================================================================

# Directory containing dbt_project.yml.
DBT_PROJECT_DIR = "/opt/dbt/finpulse"

# Directory containing profiles.yml.
#
# The dbt project and profiles directory are the same directory in the
# current FinPulse container layout:
#
#     /opt/dbt/finpulse/
#         dbt_project.yml
#         profiles.yml
#         models/
#         seeds/
#         tests/
#         macros/
#
# This can still be overridden through the environment for future
# deployments.
DBT_PROFILES_DIR = os.environ.get(
    "DBT_PROFILES_DIR",
    "/opt/dbt/finpulse",
)


# =====================================================================
# PIPELINE MONITORING
# =====================================================================

def get_failed_root_tasks(dag_run):
    """
    Identify the actual failed/root task(s) for a failed DAG run.

    Airflow's failure callback context can contain a task instance that
    is not the original failing task. For example, a downstream task
    may be marked as ``upstream_failed`` after an earlier task fails.

    This helper therefore inspects every task instance in the DAG run
    and returns tasks whose state is explicitly ``failed``.

    Tasks marked ``upstream_failed`` are intentionally excluded because
    they did not fail themselves; they were skipped due to an upstream
    failure.

    Returns:
        A comma-separated string containing the failed task IDs, or
        ``None`` when no explicitly failed task can be identified.
    """

    failed_tasks = []

    for task_instance in dag_run.get_task_instances():

        if task_instance.state == "failed":
            failed_tasks.append(task_instance.task_id)

    if not failed_tasks:
        return None

    failed_tasks.sort()

    return ", ".join(failed_tasks)


def record_pipeline_success(context):
    """
    Record a successful FinPulse batch pipeline run.

    Airflow invokes this callback after the DAG has completed
    successfully.
    """

    dag_run = context["dag_run"]

    engine = create_engine(
        WAREHOUSE_DB_URI,
        pool_pre_ping=True,
    )

    try:

        with engine.begin() as conn:

            conn.execute(
                text(
                    """
                    INSERT INTO monitoring.pipeline_runs (
                        run_id,
                        dag_id,
                        status,
                        started_at,
                        finished_at,
                        failed_task
                    )
                    VALUES (
                        :run_id,
                        :dag_id,
                        'SUCCESS',
                        :started_at,
                        :finished_at,
                        NULL
                    )
                    ON CONFLICT (run_id)
                    DO UPDATE SET
                        status = EXCLUDED.status,
                        finished_at = EXCLUDED.finished_at,
                        failed_task = EXCLUDED.failed_task,
                        recorded_at = CURRENT_TIMESTAMP
                    """
                ),
                {
                    "run_id": dag_run.run_id,
                    "dag_id": dag_run.dag_id,
                    "started_at": dag_run.start_date,
                    "finished_at": pendulum.now("UTC"),
                },
            )

    finally:

        engine.dispose()


def record_pipeline_failure(context):
    """
    Record a failed FinPulse batch pipeline run.

    Airflow invokes this callback when the DAG fails.

    Instead of trusting ``context["task_instance"]`` as the failed
    task, the callback inspects all task instances belonging to the DAG
    run and records tasks whose state is explicitly ``failed``.

    This prevents downstream ``upstream_failed`` tasks from being
    incorrectly reported as the root failure.

    Multiple explicitly failed tasks are stored as a comma-separated
    list in the ``failed_task`` column.
    """

    dag_run = context["dag_run"]

    failed_task = get_failed_root_tasks(dag_run)

    engine = create_engine(
        WAREHOUSE_DB_URI,
        pool_pre_ping=True,
    )

    try:

        with engine.begin() as conn:

            conn.execute(
                text(
                    """
                    INSERT INTO monitoring.pipeline_runs (
                        run_id,
                        dag_id,
                        status,
                        started_at,
                        finished_at,
                        failed_task
                    )
                    VALUES (
                        :run_id,
                        :dag_id,
                        'FAILED',
                        :started_at,
                        :finished_at,
                        :failed_task
                    )
                    ON CONFLICT (run_id)
                    DO UPDATE SET
                        status = EXCLUDED.status,
                        finished_at = EXCLUDED.finished_at,
                        failed_task = EXCLUDED.failed_task,
                        recorded_at = CURRENT_TIMESTAMP
                    """
                ),
                {
                    "run_id": dag_run.run_id,
                    "dag_id": dag_run.dag_id,
                    "started_at": dag_run.start_date,
                    "finished_at": pendulum.now("UTC"),
                    "failed_task": failed_task,
                },
            )

    finally:

        engine.dispose()


# =====================================================================
# AIRFLOW DAG
# =====================================================================

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
    on_success_callback=record_pipeline_success,
    on_failure_callback=record_pipeline_failure,
    tags=[
        "finpulse",
        "batch",
        "etl",
        "dbt",
        "lambda-architecture",
        "monitoring",
    ],
)
def finpulse_batch_etl():

    # =================================================================
    # EXTRACT SOURCE -> RAW
    # =================================================================

    @task
    def extract_source_to_raw():
        """
        Perform a full extract of the OLTP source tables into
        warehouse.raw.

        The raw tables are preserved between pipeline runs because
        downstream dbt views depend on them.

        On each run:

            1. Reflect the source table.
            2. Create the raw table if it does not exist.
            3. TRUNCATE the existing raw table.
            4. Load the complete source dataset.
            5. Report loaded row counts.

        SQLAlchemy Core is used directly rather than
        pandas.read_sql_table or pandas.to_sql.

        PostgreSQL generated/computed columns are preserved in the
        warehouse schema and excluded from INSERT statements.

        Foreign-key constraints from the OLTP source are intentionally
        removed from the raw tables. The source database owns
        referential integrity, while the raw layer acts as an ingestion
        boundary.
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

                        print(
                            f"Extracting source table: {table_name}"
                        )

                        # -------------------------------------------------
                        # Reflect the source table from PostgreSQL.
                        # -------------------------------------------------

                        source_table = Table(
                            table_name,
                            source_metadata,
                            schema="public",
                            autoload_with=source_engine,
                        )

                        # -------------------------------------------------
                        # Build the warehouse representation.
                        #
                        # The raw table is only created if it does not
                        # already exist. This is important because dbt
                        # staging and monitoring views depend on these
                        # tables.
                        # -------------------------------------------------

                        warehouse_metadata = MetaData(
                            schema="raw"
                        )

                        warehouse_table = source_table.to_metadata(
                            warehouse_metadata,
                            schema="raw",
                        )

                        # -------------------------------------------------
                        # IMPORTANT:
                        #
                        # Do not copy OLTP foreign-key constraints into
                        # the raw warehouse layer.
                        #
                        # The source PostgreSQL database already enforces
                        # these relationships.
                        # -------------------------------------------------

                        for constraint in list(
                            warehouse_table.constraints
                        ):

                            if isinstance(
                                constraint,
                                ForeignKeyConstraint,
                            ):

                                warehouse_table.constraints.remove(
                                    constraint
                                )

                        # -------------------------------------------------
                        # Create the raw table if it does not already
                        # exist.
                        #
                        # checkfirst=True prevents PostgreSQL from
                        # dropping/recreating a table that downstream
                        # dbt views depend on.
                        # -------------------------------------------------

                        warehouse_table.create(
                            bind=warehouse_conn,
                            checkfirst=True,
                        )

                        # -------------------------------------------------
                        # Clear the existing raw data.
                        #
                        # TRUNCATE removes rows without removing the
                        # table itself, so dependent dbt views remain
                        # intact.
                        # -------------------------------------------------

                        warehouse_conn.execute(
                            text(
                                f'TRUNCATE TABLE raw."{table_name}"'
                            )
                        )

                        # -------------------------------------------------
                        # Generated/computed columns must not be included
                        # in INSERT statements.
                        # -------------------------------------------------

                        insertable_columns = {
                            column.name
                            for column in warehouse_table.columns
                            if column.computed is None
                        }

                        rows = []

                        # -------------------------------------------------
                        # Extract rows from the source table.
                        # -------------------------------------------------

                        result = source_conn.execute(
                            source_table.select()
                        )

                        for row in result:

                            mapped_row = dict(
                                row._mapping
                            )

                            filtered_row = {
                                key: value
                                for key, value in mapped_row.items()
                                if key in insertable_columns
                            }

                            rows.append(
                                filtered_row
                            )

                        # -------------------------------------------------
                        # Bulk insert into raw.
                        # -------------------------------------------------

                        if rows:

                            warehouse_conn.execute(
                                insert(warehouse_table),
                                rows,
                            )

                        row_counts[table_name] = len(rows)

                        print(
                            f"Loaded raw.{table_name}: "
                            f"{len(rows)} rows"
                        )

        finally:

            source_engine.dispose()
            warehouse_engine.dispose()

        print(
            "Source extraction completed successfully."
        )

        print(
            f"Row counts: {row_counts}"
        )

        return row_counts

    # =================================================================
    # REALTIME COMPACTION
    # =================================================================

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

                # -----------------------------------------------------
                # Update the authoritative realtime table using the
                # latest staging record for each window.
                # -----------------------------------------------------

                conn.execute(
                    text(
                        """
                        INSERT INTO realtime.revenue_by_minute (
                            window_start,
                            order_count,
                            revenue,
                            updated_at
                        )
                        SELECT
                            window_start,
                            order_count,
                            revenue,
                            NOW()
                        FROM (
                            SELECT
                                window_start,
                                order_count,
                                revenue,
                                ROW_NUMBER() OVER (
                                    PARTITION BY window_start
                                    ORDER BY ingested_at DESC
                                ) AS row_number
                            FROM realtime.revenue_by_minute_staging
                        ) latest
                        WHERE row_number = 1
                        ON CONFLICT (window_start)
                        DO UPDATE SET
                            order_count = EXCLUDED.order_count,
                            revenue = EXCLUDED.revenue,
                            updated_at = NOW()
                        """
                    )
                )

                # -----------------------------------------------------
                # Remove staging rows after successful compaction.
                # -----------------------------------------------------

                conn.execute(
                    text(
                        """
                        TRUNCATE TABLE
                            realtime.revenue_by_minute_staging
                        """
                    )
                )

                print(
                    "Realtime revenue staging table "
                    "compacted successfully."
                )

        finally:

            engine.dispose()

    # =================================================================
    # BATCH PIPELINE TASKS
    # =================================================================

    extracted = extract_source_to_raw()

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

    realtime_compaction = compact_realtime_layer()

    # =================================================================
    # TASK DEPENDENCIES
    # =================================================================

    extracted >> dbt_seed >> dbt_run >> dbt_test >> realtime_compaction


# =====================================================================
# DAG REGISTRATION
# =====================================================================

finpulse_batch_etl()

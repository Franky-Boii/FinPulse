from datetime import datetime, timezone
from typing import Any

import redis
import requests
from fastapi import APIRouter

from sqlalchemy import text

from ..db import (
    redis_client,
    source_engine,
    warehouse_engine,
)


router = APIRouter(
    prefix="/pipeline",
    tags=["pipeline health"],
)


DEBEZIUM_URL = "http://debezium:8083"

AIRFLOW_URL = "http://airflow-webserver:8080"

REDPANDA_ADMIN_URL = "http://redpanda:9644"


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def healthy(
    name: str,
    message: str,
    latency_ms: float | None = None,
    details: dict[str, Any] | None = None,
):
    return {
        "name": name,
        "status": "healthy",
        "message": message,
        "latency_ms": latency_ms,
        "details": details or {},
    }


def degraded(
    name: str,
    message: str,
    latency_ms: float | None = None,
    details: dict[str, Any] | None = None,
):
    return {
        "name": name,
        "status": "degraded",
        "message": message,
        "latency_ms": latency_ms,
        "details": details or {},
    }


def unhealthy(
    name: str,
    message: str,
    latency_ms: float | None = None,
    details: dict[str, Any] | None = None,
):
    return {
        "name": name,
        "status": "unhealthy",
        "message": message,
        "latency_ms": latency_ms,
        "details": details or {},
    }


def check_warehouse():
    started = datetime.now(timezone.utc)

    try:
        with warehouse_engine.connect() as conn:
            result = conn.execute(
                text("SELECT current_database(), version()")
            ).one()

        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        return healthy(
            "PostgreSQL Warehouse",
            "Warehouse database connection is healthy.",
            round(elapsed, 2),
            {
                "database": result[0],
            },
        )

    except Exception as exc:
        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        return unhealthy(
            "PostgreSQL Warehouse",
            "Unable to connect to the warehouse database.",
            round(elapsed, 2),
            {
                "error": str(exc),
            },
        )


def check_source_database():
    started = datetime.now(timezone.utc)

    try:
        with source_engine.connect() as conn:
            result = conn.execute(
                text(
                    """
                    SELECT
                        current_database(),
                        COUNT(*) AS order_count
                    FROM public.orders
                    """
                )
            ).one()

        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        return healthy(
            "PostgreSQL Source",
            "Source OLTP database is reachable.",
            round(elapsed, 2),
            {
                "database": result[0],
                "orders": int(result[1]),
            },
        )

    except Exception as exc:
        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        return unhealthy(
            "PostgreSQL Source",
            "Unable to connect to the source database.",
            round(elapsed, 2),
            {
                "error": str(exc),
            },
        )


def check_redis():
    started = datetime.now(timezone.utc)

    try:
        response = redis_client.ping()

        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        if response:
            return healthy(
                "Redis",
                "Redis is responding to PING.",
                round(elapsed, 2),
            )

        return unhealthy(
            "Redis",
            "Redis did not return a successful PING.",
            round(elapsed, 2),
        )

    except redis.RedisError as exc:
        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        return unhealthy(
            "Redis",
            "Redis connection failed.",
            round(elapsed, 2),
            {
                "error": str(exc),
            },
        )


def check_redpanda():
    started = datetime.now(timezone.utc)

    try:
        response = requests.get(
            f"{REDPANDA_ADMIN_URL}/v1/status/ready",
            timeout=3,
        )

        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        if response.status_code == 200:
            return healthy(
                "Redpanda",
                "Redpanda broker is ready.",
                round(elapsed, 2),
            )

        return degraded(
            "Redpanda",
            f"Redpanda readiness returned HTTP {response.status_code}.",
            round(elapsed, 2),
        )

    except requests.RequestException as exc:
        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        return unhealthy(
            "Redpanda",
            "Unable to reach the Redpanda Admin API.",
            round(elapsed, 2),
            {
                "error": str(exc),
            },
        )


def check_debezium():
    started = datetime.now(timezone.utc)

    try:
        response = requests.get(
            f"{DEBEZIUM_URL}/connectors",
            timeout=3,
        )

        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        if response.status_code != 200:
            return degraded(
                "Debezium CDC",
                f"Kafka Connect returned HTTP {response.status_code}.",
                round(elapsed, 2),
            )

        connectors = response.json()

        connector_details = []

        for connector in connectors:
            try:
                status_response = requests.get(
                    f"{DEBEZIUM_URL}/connectors/{connector}/status",
                    timeout=2,
                )

                status_data = status_response.json()

                connector_state = status_data.get(
                    "connector",
                    {},
                ).get(
                    "state",
                    "UNKNOWN",
                )

                connector_details.append(
                    {
                        "name": connector,
                        "state": connector_state,
                    }
                )

            except requests.RequestException:
                connector_details.append(
                    {
                        "name": connector,
                        "state": "UNKNOWN",
                    }
                )

        failed_connectors = [
            connector
            for connector in connector_details
            if connector["state"] != "RUNNING"
        ]

        if failed_connectors:
            return degraded(
                "Debezium CDC",
                "Debezium is reachable but one or more connectors are not running.",
                round(elapsed, 2),
                {
                    "connectors": connector_details,
                },
            )

        return healthy(
            "Debezium CDC",
            "Kafka Connect is reachable and CDC connectors are running.",
            round(elapsed, 2),
            {
                "connectors": connector_details,
            },
        )

    except requests.RequestException as exc:
        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        return unhealthy(
            "Debezium CDC",
            "Unable to reach the Debezium REST API.",
            round(elapsed, 2),
            {
                "error": str(exc),
            },
        )


def check_spark_stream():
    started = datetime.now(timezone.utc)

    try:
        revenue = redis_client.hgetall(
            "finpulse:realtime:revenue:latest"
        )

        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        if not revenue:
            return degraded(
                "Spark Streaming",
                "No realtime revenue output is currently available in Redis.",
                round(elapsed, 2),
            )

        window_start = revenue.get("window_start")

        if not window_start:
            return degraded(
                "Spark Streaming",
                "Redis is reachable but no streaming window timestamp is available.",
                round(elapsed, 2),
            )

        try:
            parsed_window = datetime.fromisoformat(window_start)

            # Redis stores the Spark window timestamp without timezone information.
            # Treat it as UTC before comparing it with the current UTC time.
            if parsed_window.tzinfo is None:
                parsed_window = parsed_window.replace(tzinfo=timezone.utc)

            age_seconds = (
                datetime.now(timezone.utc) - parsed_window
            ).total_seconds()

        except ValueError:
            age_seconds = None

        if age_seconds is not None and age_seconds > 300:
            return degraded(
                "Spark Streaming",
                "Realtime output exists but appears stale.",
                round(elapsed, 2),
                {
                    "window_start": window_start,
                    "age_seconds": round(age_seconds, 2),
                },
            )

        return healthy(
            "Spark Streaming",
            "Realtime streaming output is being produced.",
            round(elapsed, 2),
            {
                "window_start": window_start,
                "age_seconds": (
                    round(age_seconds, 2)
                    if age_seconds is not None
                    else None
                ),
            },
        )

    except redis.RedisError as exc:
        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        return unhealthy(
            "Spark Streaming",
            "Unable to inspect Spark's realtime output.",
            round(elapsed, 2),
            {
                "error": str(exc),
            },
        )


def check_airflow():
    started = datetime.now(timezone.utc)

    try:
        response = requests.get(
            f"{AIRFLOW_URL}/health",
            timeout=3,
        )

        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        if response.status_code != 200:
            return degraded(
                "Airflow",
                f"Airflow health endpoint returned HTTP {response.status_code}.",
                round(elapsed, 2),
            )

        data = response.json()

        scheduler_state = data.get(
            "scheduler",
            {},
        ).get(
            "status",
            "unknown",
        )

        metadatabase_state = data.get(
            "metadatabase",
            {},
        ).get(
            "status",
            "unknown",
        )

        if (
            scheduler_state == "healthy"
            and metadatabase_state == "healthy"
        ):
            return healthy(
                "Airflow",
                "Airflow scheduler and metadata database are healthy.",
                round(elapsed, 2),
                data,
            )

        return degraded(
            "Airflow",
            "Airflow is reachable but one or more health checks are not healthy.",
            round(elapsed, 2),
            data,
        )

    except requests.RequestException as exc:
        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        return unhealthy(
            "Airflow",
            "Unable to reach the Airflow health endpoint.",
            round(elapsed, 2),
            {
                "error": str(exc),
            },
        )


def check_dbt():
    started = datetime.now(timezone.utc)

    try:
        with warehouse_engine.connect() as conn:
            result = conn.execute(
                text(
                    """
                    SELECT
                        COUNT(*) AS customer_count,
                        COALESCE(
                            SUM(total_order_value),
                            0
                        ) AS revenue
                    FROM marts.mart_customer_metrics
                    """
                )
            ).one()

        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        customer_count = int(result[0])
        revenue = float(result[1])

        if customer_count == 0:
            return degraded(
                "dbt Batch Layer",
                "dbt mart exists but contains no customer records.",
                round(elapsed, 2),
            )

        return healthy(
            "dbt Batch Layer",
            "dbt customer mart is populated and queryable.",
            round(elapsed, 2),
            {
                "customer_count": customer_count,
                "revenue": revenue,
            },
        )

    except Exception as exc:
        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        return unhealthy(
            "dbt Batch Layer",
            "Unable to query the dbt marts.",
            round(elapsed, 2),
            {
                "error": str(exc),
            },
        )


def check_order_generator():
    started = datetime.now(timezone.utc)

    try:
        with source_engine.connect() as conn:
            result = conn.execute(
                text(
                    """
                    SELECT
                        COUNT(*) AS orders,
                        MAX(created_at) AS latest_order
                    FROM public.orders
                    """
                )
            ).one()

        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        orders = int(result[0])
        latest_order = result[1]

        if latest_order is None:
            return degraded(
                "Order Generator",
                "No orders have been generated yet.",
                round(elapsed, 2),
            )

        latest_order_utc = latest_order

        if latest_order_utc.tzinfo is None:
            latest_order_utc = latest_order_utc.replace(
                tzinfo=timezone.utc
            )

        age_seconds = (
            datetime.now(timezone.utc) - latest_order_utc
        ).total_seconds()

        if age_seconds > 300:
            return degraded(
                "Order Generator",
                "Orders exist, but the latest source event appears stale.",
                round(elapsed, 2),
                {
                    "orders": orders,
                    "latest_order": latest_order.isoformat(),
                    "age_seconds": round(age_seconds, 2),
                },
            )

        return healthy(
            "Order Generator",
            "Recent order events are being generated.",
            round(elapsed, 2),
            {
                "orders": orders,
                "latest_order": latest_order.isoformat(),
                "age_seconds": round(age_seconds, 2),
            },
        )

    except Exception as exc:
        elapsed = (
            datetime.now(timezone.utc) - started
        ).total_seconds() * 1000

        return unhealthy(
            "Order Generator",
            "Unable to inspect source order activity.",
            round(elapsed, 2),
            {
                "error": str(exc),
            },
        )


def check_fastapi():
    return healthy(
        "FastAPI",
        "Serving layer is responding.",
        0,
        {
            "endpoint": "/health",
        },
    )


@router.get("/health")
def pipeline_health():
    checks = [
        check_fastapi(),
        check_source_database(),
        check_warehouse(),
        check_redis(),
        check_redpanda(),
        check_debezium(),
        check_spark_stream(),
        check_airflow(),
        check_dbt(),
        check_order_generator(),
    ]

    healthy_count = sum(
        1
        for check in checks
        if check["status"] == "healthy"
    )

    degraded_count = sum(
        1
        for check in checks
        if check["status"] == "degraded"
    )

    unhealthy_count = sum(
        1
        for check in checks
        if check["status"] == "unhealthy"
    )

    if unhealthy_count > 0:
        overall_status = "unhealthy"
    elif degraded_count > 0:
        overall_status = "degraded"
    else:
        overall_status = "healthy"

    return {
        "status": overall_status,
        "checked_at": now_utc(),
        "summary": {
            "total": len(checks),
            "healthy": healthy_count,
            "degraded": degraded_count,
            "unhealthy": unhealthy_count,
        },
        "checks": checks,
    }

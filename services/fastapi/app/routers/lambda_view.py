"""
The "serving layer" in the classic Lambda architecture sense: merges
the authoritative-but-stale batch view with the fast-but-approximate
speed view, so a client gets one coherent answer to "how are we doing
right now" without caring which layer produced which part of it.
"""

from datetime import date

from fastapi import APIRouter
from sqlalchemy import text

from ..db import engine, redis_client

router = APIRouter(prefix="/lambda", tags=["merged (lambda) view"])


def merge_layers(
    batch_orders: int,
    batch_revenue: float,
    speed_orders: int,
    speed_revenue: float,
) -> dict[str, float | int]:
    """
    Pure merge step of the Lambda architecture's serving layer: combines
    the authoritative batch totals with the latest speed-layer window into
    one merged estimate.

    Kept separate from today_revenue() so the merge arithmetic can be unit
    tested without a running Postgres warehouse or Redis instance.
    """
    return {
        "order_count": batch_orders + speed_orders,
        "revenue": round(batch_revenue + speed_revenue, 2),
    }


@router.get("/today-revenue")
def today_revenue():
    today = date.today()

    with engine.connect() as conn:
        batch_row = conn.execute(
            text("""
                SELECT order_count, revenue
                FROM marts.mart_daily_revenue
                WHERE order_date = :today
            """),
            {"today": today},
        ).mappings().first()

    batch_orders = batch_row["order_count"] if batch_row else 0
    batch_revenue = float(batch_row["revenue"]) if batch_row and batch_row["revenue"] else 0.0

    speed = redis_client.hgetall("finpulse:realtime:revenue:latest")
    speed_orders = int(speed.get("order_count", 0)) if speed else 0
    speed_revenue = float(speed.get("revenue", 0.0)) if speed else 0.0

    merged = merge_layers(batch_orders, batch_revenue, speed_orders, speed_revenue)

    return {
        "date": str(today),
        "batch_layer": {
            "order_count": batch_orders,
            "revenue": round(batch_revenue, 2),
            "note": "authoritative as of the last hourly Airflow run",
        },
        "speed_layer_latest_minute": {
            "window_start": speed.get("window_start") if speed else None,
            "order_count": speed_orders,
            "revenue": round(speed_revenue, 2),
            "note": "approximate, last 1-minute window only, sub-minute latency",
        },
        "merged_estimate": {
            "order_count": merged["order_count"],
            "revenue": merged["revenue"],
            "note": "batch total for today + the most recent minute not yet reflected in batch",
        },
    }
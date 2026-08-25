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
            "order_count": batch_orders + speed_orders,
            "revenue": round(batch_revenue + speed_revenue, 2),
            "note": "batch total for today + the most recent minute not yet reflected in batch",
        },
    }

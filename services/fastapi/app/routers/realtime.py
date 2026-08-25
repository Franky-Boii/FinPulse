from fastapi import APIRouter

from ..db import redis_client

router = APIRouter(prefix="/realtime", tags=["realtime layer"])


@router.get("/revenue")
def latest_revenue_window():
    """Most recent 1-minute revenue window, written by the Spark
    Structured Streaming job. Sub-second latency, approximate — it
    reflects payments seen in the last micro-batch, not the fully
    reconciled batch-layer number."""
    data = redis_client.hgetall("finpulse:realtime:revenue:latest")
    if not data:
        return {"window_start": None, "order_count": 0, "revenue": 0.0}
    return {
        "window_start": data.get("window_start"),
        "order_count": int(data.get("order_count", 0)),
        "revenue": float(data.get("revenue", 0.0)),
    }


@router.get("/top-products")
def realtime_top_products(limit: int = 10):
    """Top products by revenue in the last completed 5-minute window."""
    items = redis_client.zrevrange("finpulse:realtime:top_products", 0, limit - 1, withscores=True)
    return [{"product_name": name, "revenue": round(score, 2)} for name, score in items]

from fastapi import APIRouter
from sqlalchemy import text

from ..db import engine

router = APIRouter(prefix="/batch", tags=["batch layer"])


@router.get("/daily-revenue")
def daily_revenue(limit: int = 30):
    """Authoritative daily revenue, from the dbt mart. Refreshed once
    per Airflow batch run (hourly in this demo)."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT order_date, order_count, revenue, units_sold
                FROM marts.mart_daily_revenue
                ORDER BY order_date DESC
                LIMIT :limit
            """),
            {"limit": limit},
        ).mappings().all()
    return [dict(r) for r in rows]


@router.get("/top-products")
def top_products(limit: int = 10):
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT product_id, product_name, category, units_sold, revenue
                FROM marts.mart_top_products
                ORDER BY revenue DESC NULLS LAST
                LIMIT :limit
            """),
            {"limit": limit},
        ).mappings().all()
    return [dict(r) for r in rows]


@router.get("/customers-by-region")
def customers_by_region():
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT region, COUNT(*) AS customer_count
                FROM marts.dim_customers_enriched
                GROUP BY region
                ORDER BY customer_count DESC
            """)
        ).mappings().all()
    return [dict(r) for r in rows]

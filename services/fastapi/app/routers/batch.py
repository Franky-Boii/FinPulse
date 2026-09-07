from fastapi import APIRouter
from sqlalchemy import text

from ..db import engine

router = APIRouter(prefix="/batch", tags=["batch layer"])


@router.get("/daily-revenue")
def daily_revenue(limit: int = 30):
    """Authoritative daily revenue from the dbt mart."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    order_date,
                    order_count,
                    revenue,
                    units_sold
                FROM marts.mart_daily_revenue
                ORDER BY order_date DESC
                LIMIT :limit
            """),
            {"limit": limit},
        ).mappings().all()

    return [dict(row) for row in rows]


@router.get("/top-products")
def top_products(limit: int = 10):
    """Top products ranked by revenue."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    product_id,
                    product_name,
                    category,
                    units_sold,
                    revenue
                FROM marts.mart_top_products
                ORDER BY revenue DESC NULLS LAST
                LIMIT :limit
            """),
            {"limit": limit},
        ).mappings().all()

    return [dict(row) for row in rows]


@router.get("/customers-summary")
def customers_summary():
    """High-level customer metrics from the dbt customer mart."""
    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT
                    COUNT(*) AS customer_count,
                    COALESCE(SUM(order_count), 0) AS total_orders,
                    COALESCE(SUM(total_order_value), 0) AS total_revenue,
                    COALESCE(SUM(total_units_sold), 0) AS total_units
                FROM marts.mart_customer_metrics
            """)
        ).mappings().one()

    customer_count = int(row["customer_count"])
    total_orders = int(row["total_orders"])
    total_revenue = float(row["total_revenue"])
    total_units = int(row["total_units"])

    return {
        "customer_count": customer_count,
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "total_units": total_units,
        "average_customer_spend": (
            total_revenue / customer_count
            if customer_count > 0
            else 0
        ),
        "average_orders_per_customer": (
            total_orders / customer_count
            if customer_count > 0
            else 0
        ),
    }


@router.get("/customer-metrics")
def customer_metrics(limit: int = 20):
    """Customer-level purchasing metrics."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    customer_id,
                    full_name,
                    email,
                    country,
                    region,
                    order_count,
                    total_order_value,
                    total_units_sold,
                    first_order_date,
                    latest_order_date
                FROM marts.mart_customer_metrics
                ORDER BY total_order_value DESC NULLS LAST
                LIMIT :limit
            """),
            {"limit": limit},
        ).mappings().all()

    return [dict(row) for row in rows]


@router.get("/customers-by-region")
def customers_by_region():
    """Customer distribution by region."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    region,
                    COUNT(*) AS customer_count
                FROM marts.dim_customers
                GROUP BY region
                ORDER BY customer_count DESC
            """)
        ).mappings().all()

    return [dict(row) for row in rows]
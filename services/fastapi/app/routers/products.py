from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from ..db import engine


router = APIRouter(
    prefix="/batch/products",
    tags=["products"],
)


@router.get("/{product_id}")
def product_details(product_id: int):
    """
    Return product information and aggregated sales performance.
    """

    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT
                    p.product_id,
                    p.product_name,
                    p.category,
                    p.unit_price,
                    p.created_at,
                    p.updated_at,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN o.order_status NOT IN ('cancelled', 'canceled')
                                THEN oi.quantity
                                ELSE 0
                            END
                        ),
                        0
                    ) AS units_sold,

                    COALESCE(
                        SUM(
                            CASE
                                WHEN o.order_status NOT IN ('cancelled', 'canceled')
                                THEN oi.line_total
                                ELSE 0
                            END
                        ),
                        0
                    ) AS revenue,

                    COUNT(
                        DISTINCT CASE
                            WHEN o.order_status NOT IN ('cancelled', 'canceled')
                            THEN oi.order_id
                        END
                    ) AS order_count

                FROM marts.dim_products p

                LEFT JOIN raw.order_items oi
                    ON p.product_id = oi.product_id

                LEFT JOIN marts.fact_orders o
                    ON oi.order_id = o.order_id

                WHERE p.product_id = :product_id

                GROUP BY
                    p.product_id,
                    p.product_name,
                    p.category,
                    p.unit_price,
                    p.created_at,
                    p.updated_at
            """),
            {"product_id": product_id},
        ).mappings().first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"Product {product_id} not found",
        )

    return {
        "product": {
            "product_id": row["product_id"],
            "product_name": row["product_name"],
            "category": row["category"],
            "unit_price": float(row["unit_price"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        },
        "metrics": {
            "units_sold": int(row["units_sold"]),
            "revenue": float(row["revenue"]),
            "order_count": int(row["order_count"]),
        },
    }


@router.get("/{product_id}/sales-history")
def product_sales_history(
    product_id: int,
    limit: int = 30,
):
    """
    Return daily sales performance for a product.
    """

    with engine.connect() as conn:

        # First verify that the product exists.
        product_exists = conn.execute(
            text("""
                SELECT 1
                FROM marts.dim_products
                WHERE product_id = :product_id
            """),
            {"product_id": product_id},
        ).first()

        if product_exists is None:
            raise HTTPException(
                status_code=404,
                detail=f"Product {product_id} not found",
            )

        rows = conn.execute(
            text("""
                SELECT
                    o.order_date,

                    COALESCE(
                        SUM(oi.quantity),
                        0
                    ) AS units_sold,

                    COALESCE(
                        SUM(oi.line_total),
                        0
                    ) AS revenue,

                    COUNT(
                        DISTINCT o.order_id
                    ) AS order_count

                FROM raw.order_items oi

                INNER JOIN marts.fact_orders o
                    ON oi.order_id = o.order_id

                WHERE
                    oi.product_id = :product_id
                    AND o.order_status NOT IN ('cancelled', 'canceled')

                GROUP BY
                    o.order_date

                ORDER BY
                    o.order_date DESC

                LIMIT :limit
            """),
            {
                "product_id": product_id,
                "limit": limit,
            },
        ).mappings().all()

    return [
        {
            "order_date": row["order_date"],
            "units_sold": int(row["units_sold"]),
            "revenue": float(row["revenue"]),
            "order_count": int(row["order_count"]),
        }
        for row in rows
    ]


@router.get("/{product_id}/orders")
def product_recent_orders(
    product_id: int,
    limit: int = 20,
):
    """
    Return recent orders containing the selected product.
    """

    with engine.connect() as conn:

        # First verify that the product exists.
        product_exists = conn.execute(
            text("""
                SELECT 1
                FROM marts.dim_products
                WHERE product_id = :product_id
            """),
            {"product_id": product_id},
        ).first()

        if product_exists is None:
            raise HTTPException(
                status_code=404,
                detail=f"Product {product_id} not found",
            )

        rows = conn.execute(
            text("""
                SELECT
                    o.order_id,
                    o.customer_id,
                    o.customer_name,
                    o.customer_email,
                    o.order_date,
                    o.order_status,

                    COALESCE(
                        SUM(oi.quantity),
                        0
                    ) AS quantity,

                    COALESCE(
                        SUM(oi.line_total),
                        0
                    ) AS revenue

                FROM raw.order_items oi

                INNER JOIN marts.fact_orders o
                    ON oi.order_id = o.order_id

                WHERE
                    oi.product_id = :product_id

                GROUP BY
                    o.order_id,
                    o.customer_id,
                    o.customer_name,
                    o.customer_email,
                    o.order_date,
                    o.order_status

                ORDER BY
                    o.order_date DESC,
                    o.order_id DESC

                LIMIT :limit
            """),
            {
                "product_id": product_id,
                "limit": limit,
            },
        ).mappings().all()

    return [
        {
            "order_id": row["order_id"],
            "customer_id": row["customer_id"],
            "customer_name": row["customer_name"],
            "customer_email": row["customer_email"],
            "order_date": row["order_date"],
            "order_status": row["order_status"],
            "quantity": int(row["quantity"]),
            "revenue": float(row["revenue"]),
        }
        for row in rows
    ]
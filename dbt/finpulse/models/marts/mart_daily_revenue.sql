SELECT
    order_date,

    COUNT(DISTINCT order_id) AS order_count,

    COALESCE(
        SUM(
            CASE
                WHEN order_status NOT IN ('cancelled', 'canceled')
                THEN order_value
                ELSE 0
            END
        ),
        0
    ) AS revenue,

    COALESCE(
        SUM(
            CASE
                WHEN order_status NOT IN ('cancelled', 'canceled')
                THEN units_sold
                ELSE 0
            END
        ),
        0
    ) AS units_sold,

    CASE
        WHEN COUNT(DISTINCT order_id) > 0
        THEN
            SUM(
                CASE
                    WHEN order_status NOT IN ('cancelled', 'canceled')
                    THEN order_value
                    ELSE 0
                END
            )
            / COUNT(DISTINCT order_id)
        ELSE 0
    END AS average_order_value

FROM {{ ref('fact_orders') }}

GROUP BY order_date

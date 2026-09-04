SELECT
    oi.product_id,
    p.product_name,
    p.category,

    SUM(oi.quantity) AS units_sold,

    SUM(oi.line_total) AS revenue

FROM {{ ref('stg_order_items') }} oi

INNER JOIN {{ ref('dim_products') }} p
    ON oi.product_id = p.product_id

INNER JOIN {{ ref('fact_orders') }} o
    ON oi.order_id = o.order_id

WHERE o.order_status NOT IN ('cancelled', 'canceled')

GROUP BY
    oi.product_id,
    p.product_name,
    p.category

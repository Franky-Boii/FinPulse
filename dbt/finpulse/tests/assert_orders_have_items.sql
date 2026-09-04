SELECT
    o.order_id
FROM {{ ref('fact_orders') }} o
LEFT JOIN {{ ref('stg_order_items') }} oi
    ON o.order_id = oi.order_id
WHERE oi.order_id IS NULL

WITH calculated AS (
    SELECT
        o.order_id,
        o.order_value,
        COALESCE(SUM(oi.line_total), 0) AS calculated_order_value
    FROM {{ ref('fact_orders') }} o
    LEFT JOIN {{ ref('stg_order_items') }} oi
        ON o.order_id = oi.order_id
    GROUP BY
        o.order_id,
        o.order_value
)

SELECT
    order_id,
    order_value,
    calculated_order_value
FROM calculated
WHERE ABS(order_value - calculated_order_value) > 0.01

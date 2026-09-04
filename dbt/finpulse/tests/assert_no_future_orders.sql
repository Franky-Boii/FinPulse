SELECT
    order_id,
    order_ts,
    order_date
FROM {{ ref('stg_orders') }}
WHERE order_ts > CURRENT_TIMESTAMP

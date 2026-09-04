SELECT
    order_id,
    customer_id,
    LOWER(TRIM(order_status)) AS order_status,
    order_ts,
    created_at,
    updated_at,
    CAST(order_ts AS DATE) AS order_date
FROM {{ source('raw', 'orders') }}

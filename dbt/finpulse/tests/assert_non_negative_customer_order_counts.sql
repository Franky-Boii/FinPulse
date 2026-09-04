SELECT
    customer_id,
    order_count
FROM {{ ref('mart_customer_metrics') }}
WHERE order_count < 0

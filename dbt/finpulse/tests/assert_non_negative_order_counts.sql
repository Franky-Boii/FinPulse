SELECT
    order_date,
    order_count
FROM {{ ref('mart_daily_revenue') }}
WHERE order_count < 0

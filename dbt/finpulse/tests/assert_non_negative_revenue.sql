SELECT
    order_date,
    revenue
FROM {{ ref('mart_daily_revenue') }}
WHERE revenue < 0

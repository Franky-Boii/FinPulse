SELECT
    customer_id,
    customer_name,
    customer_email,
    country,

    COUNT(DISTINCT order_id) AS order_count,

    COALESCE(SUM(order_value), 0) AS total_order_value,

    COALESCE(SUM(units_sold), 0) AS total_units_sold,

    MIN(order_date) AS first_order_date,

    MAX(order_date) AS latest_order_date

FROM {{ ref('int_orders_enriched') }}

GROUP BY
    customer_id,
    customer_name,
    customer_email,
    country

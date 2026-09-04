SELECT
    c.customer_id,
    c.full_name,
    c.email,
    c.country,
    c.region,

    COALESCE(co.order_count, 0) AS order_count,

    COALESCE(co.total_order_value, 0) AS total_order_value,

    COALESCE(co.total_units_sold, 0) AS total_units_sold,

    co.first_order_date,
    co.latest_order_date

FROM {{ ref('dim_customers') }} c

LEFT JOIN {{ ref('int_customer_orders') }} co
    ON c.customer_id = co.customer_id

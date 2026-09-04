WITH orders AS (

    SELECT *
    FROM {{ ref('stg_orders') }}

),

customers AS (

    SELECT
        customer_id,
        full_name,
        email,
        country
    FROM {{ ref('stg_customers') }}

),

order_items AS (

    SELECT
        order_id,
        SUM(quantity) AS units_sold,
        SUM(line_total) AS order_value
    FROM {{ ref('stg_order_items') }}
    GROUP BY order_id

),

payments AS (

    SELECT
        order_id,
        SUM(
            CASE
                WHEN payment_status = 'success'
                THEN amount
                ELSE 0
            END
        ) AS successful_payment_amount
    FROM {{ ref('stg_payments') }}
    GROUP BY order_id

)

SELECT
    o.order_id,
    o.customer_id,
    c.full_name AS customer_name,
    c.email AS customer_email,
    c.country,
    o.order_status,
    o.order_ts,
    o.order_date,

    COALESCE(oi.units_sold, 0) AS units_sold,
    COALESCE(oi.order_value, 0) AS order_value,
    COALESCE(p.successful_payment_amount, 0) AS successful_payment_amount

FROM orders o

LEFT JOIN customers c
    ON o.customer_id = c.customer_id

LEFT JOIN order_items oi
    ON o.order_id = oi.order_id

LEFT JOIN payments p
    ON o.order_id = p.order_id

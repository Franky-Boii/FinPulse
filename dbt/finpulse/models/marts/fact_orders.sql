SELECT
    order_id,
    customer_id,
    customer_name,
    customer_email,
    country,
    order_status,
    order_ts,
    order_date,
    units_sold,
    order_value,
    successful_payment_amount

FROM {{ ref('int_orders_enriched') }}

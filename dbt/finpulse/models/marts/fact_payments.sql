SELECT
    payment_id,
    order_id,
    amount,
    payment_method,
    payment_status,
    paid_at,
    created_at

FROM {{ ref('stg_payments') }}

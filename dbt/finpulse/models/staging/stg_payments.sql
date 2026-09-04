SELECT
    payment_id,
    order_id,
    CAST(amount AS NUMERIC(12, 2)) AS amount,
    LOWER(TRIM(payment_method)) AS payment_method,
    LOWER(TRIM(payment_status)) AS payment_status,
    paid_at,
    created_at
FROM {{ source('raw', 'payments') }}

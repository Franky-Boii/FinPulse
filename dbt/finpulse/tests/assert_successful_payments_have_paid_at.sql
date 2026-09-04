SELECT
    payment_id,
    order_id,
    payment_status,
    paid_at
FROM {{ ref('stg_payments') }}
WHERE payment_status = 'success'
  AND paid_at IS NULL

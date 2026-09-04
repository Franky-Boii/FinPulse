SELECT
    payment_id,
    payment_status,
    paid_at
FROM {{ ref('stg_payments') }}
WHERE payment_status IN ('failed', 'pending')
  AND paid_at IS NOT NULL

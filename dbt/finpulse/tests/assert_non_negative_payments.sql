SELECT
    payment_id,
    amount
FROM {{ ref('stg_payments') }}
WHERE amount < 0

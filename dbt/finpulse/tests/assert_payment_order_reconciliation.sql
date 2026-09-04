SELECT
    o.order_id,
    o.order_value,
    o.successful_payment_amount
FROM {{ ref('fact_orders') }} o
WHERE o.order_status IN ('paid', 'shipped')
  AND ABS(
        COALESCE(o.order_value, 0)
        - COALESCE(o.successful_payment_amount, 0)
      ) > 0.01

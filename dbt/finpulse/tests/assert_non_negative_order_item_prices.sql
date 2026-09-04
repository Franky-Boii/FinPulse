SELECT
    order_item_id,
    unit_price
FROM {{ ref('stg_order_items') }}
WHERE unit_price < 0

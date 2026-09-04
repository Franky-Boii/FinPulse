SELECT
    order_item_id,
    line_total
FROM {{ ref('stg_order_items') }}
WHERE line_total < 0

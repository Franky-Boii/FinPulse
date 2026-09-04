SELECT
    order_item_id,
    order_id,
    product_id,
    quantity,
    CAST(unit_price AS NUMERIC(12, 2)) AS unit_price,
    CAST(line_total AS NUMERIC(12, 2)) AS line_total,
    created_at
FROM {{ source('raw', 'order_items') }}

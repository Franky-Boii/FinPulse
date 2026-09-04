SELECT
    product_id,
    units_sold
FROM {{ ref('mart_top_products') }}
WHERE units_sold < 0

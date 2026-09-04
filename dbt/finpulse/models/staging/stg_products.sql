SELECT
    product_id,
    TRIM(product_name) AS product_name,
    TRIM(category) AS category,
    CAST(unit_price AS NUMERIC(12, 2)) AS unit_price,
    created_at,
    updated_at
FROM {{ source('raw', 'products') }}

SELECT
    product_id,
    product_name,
    category,
    unit_price,
    created_at,
    updated_at

FROM {{ ref('stg_products') }}

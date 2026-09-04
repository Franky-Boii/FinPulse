WITH source_freshness AS (

    SELECT
        'customers' AS table_name,
        'transactional' AS table_type,
        MAX(updated_at) AS latest_source_timestamp
    FROM {{ source('raw', 'customers') }}

    UNION ALL

    SELECT
        'products',
        'reference',
        MAX(updated_at)
    FROM {{ source('raw', 'products') }}

    UNION ALL

    SELECT
        'orders',
        'transactional',
        MAX(updated_at)
    FROM {{ source('raw', 'orders') }}

    UNION ALL

    SELECT
        'order_items',
        'transactional',
        MAX(created_at)
    FROM {{ source('raw', 'order_items') }}

    UNION ALL

    SELECT
        'payments',
        'transactional',
        MAX(created_at)
    FROM {{ source('raw', 'payments') }}

)

SELECT
    table_name,
    table_type,
    latest_source_timestamp,
    CURRENT_TIMESTAMP AS checked_at,
    CURRENT_TIMESTAMP - latest_source_timestamp AS source_age
FROM source_freshness

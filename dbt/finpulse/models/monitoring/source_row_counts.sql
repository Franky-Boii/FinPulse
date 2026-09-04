WITH source_counts AS (

    SELECT
        'customers' AS table_name,
        COUNT(*) AS row_count
    FROM {{ source('raw', 'customers') }}

    UNION ALL

    SELECT
        'products',
        COUNT(*)
    FROM {{ source('raw', 'products') }}

    UNION ALL

    SELECT
        'orders',
        COUNT(*)
    FROM {{ source('raw', 'orders') }}

    UNION ALL

    SELECT
        'order_items',
        COUNT(*)
    FROM {{ source('raw', 'order_items') }}

    UNION ALL

    SELECT
        'payments',
        COUNT(*)
    FROM {{ source('raw', 'payments') }}

)

SELECT
    table_name,
    row_count,
    CURRENT_TIMESTAMP AS checked_at
FROM source_counts

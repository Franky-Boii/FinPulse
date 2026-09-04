SELECT
    table_name,
    row_count
FROM {{ ref('source_row_counts') }}
WHERE
       (table_name = 'customers'   AND row_count < 5000)
    OR (table_name = 'products'    AND row_count < 5)
    OR (table_name = 'orders'      AND row_count < 50000)
    OR (table_name = 'order_items' AND row_count < 100000)
    OR (table_name = 'payments'    AND row_count < 50000)

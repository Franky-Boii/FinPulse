SELECT
    customer_id,
    TRIM(full_name) AS full_name,
    LOWER(TRIM(email)) AS email,
    TRIM(country) AS country,
    signup_date,
    created_at,
    updated_at
FROM {{ source('raw', 'customers') }}

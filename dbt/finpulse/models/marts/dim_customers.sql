SELECT
    c.customer_id,
    c.full_name,
    c.email,
    c.country,
    COALESCE(r.region, 'Unknown') AS region,
    c.signup_date,
    c.created_at,
    c.updated_at

FROM {{ ref('stg_customers') }} c

LEFT JOIN {{ ref('seed_country_region') }} r
    ON c.country = r.country

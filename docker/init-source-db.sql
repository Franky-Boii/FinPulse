-- =====================================================================
-- FinPulse — Source OLTP schema (simulated e-commerce application DB)
-- This is the "system of record" that Debezium performs CDC against.
-- =====================================================================

CREATE TABLE IF NOT EXISTS customers (
    customer_id     SERIAL PRIMARY KEY,
    full_name       TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    country         TEXT NOT NULL,
    signup_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
    product_id      SERIAL PRIMARY KEY,
    product_name    TEXT NOT NULL,
    category        TEXT NOT NULL,
    unit_price      NUMERIC(10, 2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    order_id        SERIAL PRIMARY KEY,
    customer_id     INTEGER NOT NULL REFERENCES customers(customer_id),
    order_status    TEXT NOT NULL DEFAULT 'placed', -- placed | paid | shipped | cancelled
    order_ts        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
    order_item_id   SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES orders(order_id),
    product_id      INTEGER NOT NULL REFERENCES products(product_id),
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(10, 2) NOT NULL,
    line_total      NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id      SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES orders(order_id),
    amount          NUMERIC(10, 2) NOT NULL,
    payment_method  TEXT NOT NULL, -- card | eft | wallet
    payment_status  TEXT NOT NULL DEFAULT 'pending', -- pending | success | failed
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Replica identity FULL is required so Debezium emits full before/after
-- images on UPDATE/DELETE (needed for correct downstream CDC handling).
ALTER TABLE customers   REPLICA IDENTITY FULL;
ALTER TABLE products    REPLICA IDENTITY FULL;
ALTER TABLE orders      REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE payments    REPLICA IDENTITY FULL;

-- Publication Debezium's pgoutput plugin will stream from
CREATE PUBLICATION finpulse_publication FOR TABLE
    customers, products, orders, order_items, payments;

-- ---------------------------------------------------------------------
-- Seed data — a small starting catalogue + customer base so the app
-- (and the streaming/batch pipelines) have something to work with
-- before the order-generator starts producing live traffic.
-- ---------------------------------------------------------------------
INSERT INTO products (product_name, category, unit_price) VALUES
    ('Wireless Mouse', 'Electronics', 249.99),
    ('Mechanical Keyboard', 'Electronics', 899.00),
    ('USB-C Hub', 'Electronics', 349.50),
    ('Standing Desk Mat', 'Office', 599.00),
    ('Noise-Cancelling Headphones', 'Electronics', 1899.00),
    ('Ceramic Coffee Mug', 'Home', 129.00),
    ('Notebook Set (3-pack)', 'Office', 89.00),
    ('LED Desk Lamp', 'Home', 279.00),
    ('Laptop Backpack', 'Accessories', 649.00),
    ('Webcam 1080p', 'Electronics', 459.00)
ON CONFLICT DO NOTHING;

INSERT INTO customers (full_name, email, country, signup_date) VALUES
    ('Thandiwe Mokoena', 'thandiwe.m@example.com', 'South Africa', CURRENT_DATE - INTERVAL '120 days'),
    ('Liam O''Connor', 'liam.oc@example.com', 'Ireland', CURRENT_DATE - INTERVAL '90 days'),
    ('Aisha Bello', 'aisha.b@example.com', 'Nigeria', CURRENT_DATE - INTERVAL '75 days'),
    ('Chen Wei', 'chen.wei@example.com', 'Singapore', CURRENT_DATE - INTERVAL '60 days'),
    ('Sipho Ndlovu', 'sipho.n@example.com', 'South Africa', CURRENT_DATE - INTERVAL '45 days')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- FinPulse — Analytical Warehouse Initialization
-- =====================================================================
--
-- Database layers:
--
--   raw       -> Airflow-extracted OLTP data
--   staging   -> dbt-cleaned source models
--   marts     -> dbt analytical models
--   realtime  -> Spark Structured Streaming outputs
--
-- =====================================================================


-- ---------------------------------------------------------------------
-- Schemas
-- ---------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS marts;
CREATE SCHEMA IF NOT EXISTS realtime;


-- ---------------------------------------------------------------------
-- REALTIME REVENUE STAGING
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS realtime.revenue_by_minute_staging (
    window_start   TIMESTAMPTZ NOT NULL,
    order_count    INTEGER NOT NULL,
    revenue        NUMERIC(12, 2) NOT NULL,
    ingested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- REALTIME REVENUE
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS realtime.revenue_by_minute (
    window_start   TIMESTAMPTZ PRIMARY KEY,
    order_count    INTEGER NOT NULL,
    revenue        NUMERIC(12, 2) NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- REALTIME TOP PRODUCTS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS realtime.top_products_5min (
    window_start   TIMESTAMPTZ NOT NULL,
    product_id     INTEGER NOT NULL,
    product_name   TEXT NOT NULL,
    units_sold     INTEGER NOT NULL,
    revenue        NUMERIC(12, 2) NOT NULL,
    ingested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (window_start, product_id)
);


-- ---------------------------------------------------------------------
-- Helpful indexes
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_realtime_revenue_window
    ON realtime.revenue_by_minute (window_start DESC);

CREATE INDEX IF NOT EXISTS idx_realtime_revenue_staging_window
    ON realtime.revenue_by_minute_staging (window_start DESC);

CREATE INDEX IF NOT EXISTS idx_realtime_top_products_window
    ON realtime.top_products_5min (window_start DESC);

CREATE INDEX IF NOT EXISTS idx_realtime_top_products_revenue
    ON realtime.top_products_5min (revenue DESC);

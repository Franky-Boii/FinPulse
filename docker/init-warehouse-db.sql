-- =====================================================================
-- FinPulse — Analytical Warehouse Initialization
-- =====================================================================
--
-- This database contains:
--
--   raw       -> extracted OLTP data
--   staging   -> dbt staging models
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
--
-- Spark writes append-only micro-batch results here.
-- Airflow periodically compacts this table into
-- realtime.revenue_by_minute.
--
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
--
-- One row per minute.
--
-- This is the queryable speed-layer table.
--
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
--
-- Spark produces a rolling 5-minute product aggregation.
--
-- A composite primary key prevents duplicate rows for the same
-- product inside the same time window.
--
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
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS marts;
CREATE SCHEMA IF NOT EXISTS realtime;

CREATE TABLE IF NOT EXISTS realtime.revenue_by_minute_staging (
    window_start TIMESTAMPTZ NOT NULL,
    order_count INT NOT NULL,
    revenue NUMERIC(12,2) NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS realtime.revenue_by_minute (
    window_start TIMESTAMPTZ PRIMARY KEY,
    order_count INT NOT NULL,
    revenue NUMERIC(12,2) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

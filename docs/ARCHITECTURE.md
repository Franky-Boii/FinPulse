# FinPulse — Architecture

## 1. Design goal

Build a working, locally-runnable Lambda architecture that a marker
(or a future employer) can stand up with one command and watch data
flow end to end: OLTP write → CDC → stream processing → and,
independently, OLTP → batch extract → dbt transform → tested marts.

Two deliberately separate paths from the same source data, reconciled
at the serving layer. That separation *is* the architecture — it's not
incidental plumbing.

## 2. Why not just stream everything, or just batch everything?

- **Stream-only** would mean every metric — however complex — has to
  be computed correctly the first time, in a system optimized for low
  latency rather than correctness. Backfills, corrections, and complex
  multi-table joins become painful.
- **Batch-only** means the freshest number in the system is always at
  least one batch cycle old (here, up to an hour). For a business
  wanting to know "what's happening right now," that's not good enough.

Lambda architecture's tradeoff: accept the operational complexity of
running two pipelines in exchange for getting both properties. (The
well-known critique of Lambda architecture — that maintaining two
codebases for the "same" logic is expensive — is real, and is exactly
why this project intentionally keeps the speed-layer logic much
simpler than the batch layer, rather than trying to mirror it
exactly. See §6.)

## 3. Components, in data-flow order

### 3.1 Source of truth — `postgres-source`
A normal OLTP schema (`customers`, `products`, `orders`, `order_items`,
`payments`) with `wal_level=logical` enabled and a `REPLICA IDENTITY
FULL` set on every table so Debezium can emit full before/after row
images. A Postgres `PUBLICATION` (`finpulse_publication`) exposes
these five tables for logical replication.

The `order-generator` service imitates the live application: it
creates customers, places orders, adds order items, and progresses
orders through `placed → paid|cancelled → shipped`, at a configurable
rate (`EVENTS_PER_MINUTE`). This is what gives the CDC stream and the
speed layer something continuous to process.

### 3.2 Change Data Capture — Debezium
Debezium's Postgres connector attaches to the replication slot
(`finpulse_slot`) and streams every row-level change on the five
published tables as a JSON event onto a Kafka-API topic
(`finpulse.public.<table>`), with `before`/`after`/`op`/`ts_ms` fields.
No application code writes to Kafka directly — CDC reads the database's
own write-ahead log, so there's no risk of the app and the event
stream disagreeing (the classic "dual write" problem).

### 3.3 Transport — Redpanda
A single-node, Kafka-API-compatible broker. Chosen over running a full
Kafka + ZooKeeper (or KRaft) cluster because it's one container, boots
in seconds, and Spark's `kafka` source connects to it exactly as it
would to real Kafka — nothing downstream needs to know the difference.

### 3.4 Speed layer — Spark Structured Streaming
`streaming/spark_jobs/stream_processor.py` runs two concurrent
streaming queries:

1. **Revenue by minute** — consumes the `payments` CDC topic, filters
   to `payment_status = 'success'` events, applies a watermark (2
   minutes) and a 1-minute tumbling event-time window on `paid_at`,
   and aggregates `order_count` / `revenue` per window.
2. **Top products, 5-minute window** — consumes the `order_items` CDC
   topic (insert events only), stream-static-joins against a snapshot
   of `products` (loaded once via JDBC) to attach `product_name`, and
   aggregates `units_sold` / `revenue` per product per 5-minute
   tumbling window.

Both queries write via `foreachBatch` to **two sinks**:
- **Redis** — the values the FastAPI `/realtime/*` endpoints actually
  read; sorted sets and hashes chosen for O(log n)/O(1) access.
- **`warehouse.realtime.*`** (Postgres, append-only staging tables) —
  a durable record of every micro-batch's output, so nothing is lost
  if Redis restarts. The hourly batch DAG compacts this into a proper
  deduplicated table (`compact_realtime_layer` task).

### 3.5 Batch layer — Airflow + dbt
`finpulse_batch_etl` (hourly DAG):

1. **`extract_source_to_raw`** — a full-table extract of all five
   source tables into `warehouse.raw.*` via pandas/SQLAlchemy. This is
   the "EL" of ELT: no transformation happens here, just a faithful
   copy. (A production system at higher volume would do this
   incrementally; a full extract is deliberately simple here and cheap
   at this data scale — see `docs/BACKLOG.md` for the incremental-load
   issue this leaves open.)
2. **`dbt_seed`** — loads `seed_country_region.csv`, a small reference
   table mapping country → region.
3. **`dbt_run`** — executes the dbt DAG:
   - `models/staging/*` — 1:1 views over `raw`, with type casting and
     light cleaning (trimming, lower-casing categorical values). This
     is the "T" of ELT.
   - `models/marts/*` — the business-facing layer: `dim_customers`,
     `dim_products`, `dim_customers_enriched` (joined with the region
     seed), `fact_orders` (grain: one row per order line item, with
     payment status folded in), and two pre-aggregated marts,
     `mart_daily_revenue` and `mart_top_products`.
4. **`dbt_test`** — schema tests (`unique`, `not_null`,
   `relationships`, `accepted_values`) across staging and marts. This
   is the batch layer's veracity gate: if referential integrity or a
   business rule is violated, the DAG fails loudly rather than
   silently serving bad numbers.
5. **`compact_realtime_layer`** — dedupes the Spark job's append-only
   staging table into the queryable `realtime.revenue_by_minute` table
   and truncates the staging table, keeping the speed layer's own
   storage bounded.

A second, unscheduled DAG (`finpulse_bootstrap_cdc`) registers the
Debezium connector via the Kafka Connect REST API. It's separated from
the batch DAG because it's a one-time (or repair-only) operation, not
part of the recurring pipeline.

### 3.6 Serving layer — FastAPI
Three routers, deliberately kept distinct rather than hidden behind
one "smart" endpoint, so it's obvious which layer answered:

- **`/batch/*`** — reads directly from `warehouse.marts.*`. Slower to
  update (hourly) but authoritative.
- **`/realtime/*`** — reads directly from Redis. Sub-second latency,
  approximate, limited lookback (last window only).
- **`/lambda/*`** — combines both: batch total for "today so far" plus
  the most recent speed-layer minute not yet reflected in a batch run,
  giving a merged estimate. This is the textbook Lambda-architecture
  serving pattern.

## 4. Data model summary

See [`docs/DATA_MODEL.md`](DATA_MODEL.md) for full column-level detail.
In short: `raw` mirrors the OLTP schema exactly; `staging` cleans it
1:1; `marts` reshapes it into a small star schema (`fact_orders` +
`dim_customers` + `dim_products`) plus two pre-computed aggregate
marts; `realtime` holds only what the speed layer needs.

## 5. Data quality strategy

- **Structural**: Postgres foreign keys and `CHECK` constraints in the
  source schema prevent invalid data from ever being written.
- **Pipeline**: dbt tests re-verify the same invariants downstream
  (uniqueness, non-null, referential integrity) plus business-rule
  checks (`accepted_values` on `order_status`, `payment_status`) that
  the source schema can't express as a constraint.
- **Gate, not just report**: `dbt test` runs as a blocking Airflow task
  between `dbt run` and `compact_realtime_layer` — a failing test halts
  the DAG rather than letting bad marts data reach the API.

## 6. Known simplifications (and why)

This is a learning/portfolio project, not a production system. A few
choices were made explicitly to keep it buildable and runnable on a
single laptop, and are worth naming rather than hiding:

- **Full-table batch extract**, not incremental/CDC-fed batch loading.
- **Revenue-by-minute uses processing/paid_at time**, not a fully
  reconciled multi-table join — the speed layer trades modeling rigor
  for latency on purpose (see §2).
- **Single-broker Redpanda**, no replication — fine for a demo, not for
  production durability guarantees.
- **No dead-letter handling** in the Spark job for malformed CDC
  messages yet — tracked in the backlog.
- **Hourly batch schedule** rather than a more realistic nightly
  schedule, so the pipeline's output is visible within one class demo
  session rather than requiring a 24-hour wait.

See [`docs/BACKLOG.md`](BACKLOG.md) for these as tracked follow-up
issues.

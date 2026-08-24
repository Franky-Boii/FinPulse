# FinPulse

**A Lambda-architecture data platform for e-commerce order analytics.**

FinPulse is a portfolio data engineering project built to demonstrate a
complete **Lambda architecture** end to end: a live OLTP source, Change
Data Capture, a stream-processing speed layer, a batch/ELT layer built
with Airflow + dbt, and a serving API that merges both views for the
client.

The goal throughout was to use real, industry-standard tools the way they're actually used in production, not toy stand-ins.

---

## Why "Lambda architecture"?

A Lambda architecture answers one question: *how do you get both
correctness and low latency out of the same data platform?*

- The **batch layer** re-processes the full history on a schedule. It's
  slow (in FinPulse: hourly) but authoritative — if anything in the
  platform is "the truth," it's this layer.
- The **speed layer** processes only what's arrived since the last
  batch run, in near real time. It's fast (seconds) but approximate —
  it can miss late data, double-count on retries, or use simpler logic
  than the batch layer.
- The **serving layer** merges both: batch totals for everything the
  batch layer has already seen, plus the speed layer's view of
  "just now," so a client gets one coherent, low-latency, eventually-
  correct answer.

FinPulse implements all three layers on a simulated e-commerce orders
business — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the
full data-flow diagram and component breakdown.

---

## Tech stack

| Concern | Tool | Why |
|---|---|---|
| OLTP source | PostgreSQL | Logical replication makes it a natural CDC source |
| Change Data Capture | Debezium | Industry-standard CDC connector, reads the Postgres WAL directly — no dual writes, no polling |
| Event transport | Redpanda | Kafka-API compatible, single binary, far lighter to run locally than a full Kafka + ZooKeeper cluster |
| Stream processing | Spark Structured Streaming | Windowed aggregation with watermarking, exactly the pattern used in production streaming pipelines |
| Low-latency store | Redis | Sub-millisecond reads for the speed layer's output |
| Orchestration | Apache Airflow | Schedules and sequences the batch layer; DAGs express task dependencies explicitly |
| Transformation | dbt | SQL-based, testable, version-controlled transformations; staging → marts layering |
| Analytical warehouse | PostgreSQL (separate instance) | Hosts `raw` / `staging` (dbt) / `marts` / `realtime` schemas |
| Serving API | FastAPI | Exposes batch, speed, and merged endpoints |
| Containerization | Docker Compose | One command spins up all 12 services |

---

## Architecture at a glance

```
                         ┌─────────────────────┐
 order-generator ───────►│  postgres-source     │  (OLTP, logical replication on)
 (simulates the app)      │  customers/products/ │
                          │  orders/order_items/  │
                          │  payments             │
                          └──────────┬───────────┘
                                     │ WAL
                                     ▼
                          ┌─────────────────────┐
                          │  Debezium Connect     │──► CDC events
                          └──────────┬───────────┘
                                     ▼
                          ┌─────────────────────┐
                          │  Redpanda (Kafka API) │
                          └──────┬───────┬───────┘
                                 │       │
                 SPEED LAYER     │       │      BATCH LAYER
                 ────────────    ▼       │      ───────────
                 ┌───────────────────┐   │      ┌──────────────────────┐
                 │ Spark Structured   │   │      │ Airflow (hourly DAG)  │
                 │ Streaming          │   │      │  1. extract source    │
                 │ (windowed          │   │      │     -> warehouse.raw  │
                 │  aggregates)       │   │      │  2. dbt seed          │
                 └────┬──────────┬────┘   │      │  3. dbt run           │
                      │          │        │      │     (staging->marts)  │
                      ▼          ▼        │      │  4. dbt test          │
                  ┌───────┐ ┌─────────┐   │      │  5. compact realtime  │
                  │ Redis │ │warehouse│◄──┘      │     staging table     │
                  │       │ │.realtime│          └──────────┬───────────┘
                  └───┬───┘ └────┬────┘                     │
                      │          │                           ▼
                      │          │                 warehouse.marts.*
                      │          │            (dim_customers, dim_products,
                      │          │             fact_orders, mart_daily_revenue,
                      │          │             mart_top_products)
                      │          │                           │
                      ▼          ▼                           ▼
                 ┌─────────────────────────────────────────────┐
                 │            FastAPI serving layer              │
                 │  /realtime/*   /batch/*   /lambda/* (merged)   │
                 └─────────────────────────────────────────────┘
```

---

## Repository layout

```
finpulse/
├── docker-compose.yml          # all 12 services wired together
├── docker/                     # init SQL for source + warehouse DBs
├── services/
│   ├── order_generator/        # simulates live app traffic
│   └── fastapi/                # serving layer (batch/realtime/lambda routers)
├── streaming/
│   ├── spark_jobs/              # Structured Streaming speed-layer job
│   └── debezium/                 # CDC connector config
├── airflow/
│   └── dags/                    # batch_etl_dag.py, bootstrap_cdc_dag.py
├── dbt/finpulse/
│   ├── models/staging/          # 1:1 cleaned views over raw
│   ├── models/marts/             # star schema + business aggregates
│   └── seeds/                    # reference/lookup data
├── scripts/                     # helper scripts (connector registration, etc.)
├── docs/                        # architecture, data model, runbook, backlog
└── .github/                     # issue templates, CI workflow
```

---


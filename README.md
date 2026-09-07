# FinPulse

**A real-time and batch data platform for e-commerce analytics, built with a Lambda architecture.**

FinPulse is a portfolio Data Engineering platform designed to demonstrate how modern data systems can combine **Change Data Capture (CDC), event streaming, real-time processing, batch ELT, data quality, and analytical serving** into one end-to-end pipeline.

The platform simulates a continuously operating e-commerce system. Orders, payments, customers, products, and order items are generated in a PostgreSQL OLTP database. Changes are captured from the PostgreSQL WAL using Debezium, transported through Redpanda, processed by Spark Structured Streaming, and served through Redis for low-latency analytics.

In parallel, Apache Airflow periodically extracts the source data into a separate analytical warehouse, where dbt performs SQL transformations, testing, and dimensional modelling.

A FastAPI serving layer exposes both real-time and batch views, while a React dashboard provides an operational and analytical interface for the platform.

---

## Architecture

FinPulse implements the classic three-layer Lambda architecture:

```text
                         ┌─────────────────────┐
                         │   E-commerce App    │
                         │  simulated traffic  │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ PostgreSQL Source   │
                         │       OLTP          │
                         └──────────┬──────────┘
                                    │
                         PostgreSQL WAL / CDC
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │      Debezium       │
                         │    CDC Connector    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │      Redpanda       │
                         │    Event Streaming  │
                         └──────────┬──────────┘
                                    │
                       ┌────────────┴────────────┐
                       │                         │
                       ▼                         ▼
              ┌─────────────────┐      ┌──────────────────┐
              │ Spark Structured │      │ Airflow Batch    │
              │   Streaming     │      │     Pipeline     │
              └────────┬────────┘      └────────┬─────────┘
                       │                         │
                       ▼                         ▼
                ┌─────────────┐          ┌───────────────┐
                │    Redis    │          │   Warehouse   │
                │ Speed Layer │          │   PostgreSQL  │
                └──────┬──────┘          └───────┬───────┘
                       │                         │
                       │                    ┌────┴─────┐
                       │                    │    dbt   │
                       │                    └────┬─────┘
                       │                         │
                       │                         ▼
                       │                    ┌───────────┐
                       │                    │   Marts   │
                       │                    └─────┬─────┘
                       │                         │
                       └────────────┬────────────┘
                                    ▼
                         ┌─────────────────────┐
                         │      FastAPI        │
                         │   Serving Layer     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   React Dashboard   │
                         │ Analytics + Health  │
                         └─────────────────────┘
```

For a detailed explanation of the architecture and engineering decisions, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Why Lambda architecture?

Lambda architecture separates data processing into a **batch layer** and a **speed layer**, with a serving layer providing a unified view.

### Batch layer

The batch layer prioritizes correctness and completeness.

FinPulse uses:

```text
PostgreSQL
    ↓
Airflow
    ↓
warehouse.raw
    ↓
dbt staging
    ↓
dbt marts
```

The batch pipeline performs a full extraction of the current source tables, transforms the data using dbt, runs data quality tests, and produces analytical marts.

The batch layer runs hourly and is treated as the authoritative analytical view.

### Speed layer

The speed layer prioritizes low latency.

```text
PostgreSQL WAL
    ↓
Debezium
    ↓
Redpanda
    ↓
Spark Structured Streaming
    ↓
Redis
```

Spark processes CDC events continuously and produces near-real-time aggregates such as:

* Revenue by minute
* Order counts
* Top products

Redis provides low-latency access to these results.

### Serving layer

FastAPI exposes the two processing paths independently:

```text
/batch/*
/realtime/*
/lambda/*
```

The Lambda endpoints combine batch and speed-layer information to provide a low-latency view while allowing the batch layer to remain the authoritative source.

---

## Key capabilities

### 1. Change Data Capture

Debezium reads PostgreSQL's Write-Ahead Log instead of requiring application-level dual writes or database polling.

CDC events are published to Redpanda topics such as:

```text
finpulse.public.customers
finpulse.public.products
finpulse.public.orders
finpulse.public.order_items
finpulse.public.payments
```

Each event contains the information required to interpret the database change, including the operation and row state.

---

### 2. Real-time stream processing

Spark Structured Streaming consumes CDC events from Redpanda.

The current streaming workloads include:

**Revenue by minute**

* Consumes payment events
* Filters successful payments
* Uses event-time processing
* Applies a two-minute watermark
* Uses one-minute tumbling windows
* Calculates order count and revenue

**Top products**

* Consumes order-item insert events
* Uses product information from PostgreSQL
* Calculates product-level sales activity
* Uses five-minute windows

Spark writes the results to:

```text
Redis
```

and also persists streaming aggregates to:

```text
warehouse.realtime.*
```

This provides both low-latency serving and durable storage for the streaming results.

---

### 3. Batch ELT

Apache Airflow orchestrates the batch pipeline.

The main DAG is:

```text
finpulse_batch_etl
```

The workflow is:

```text
Extract source tables
        ↓
Load warehouse.raw
        ↓
dbt seed
        ↓
dbt run
        ↓
dbt test
        ↓
Compact realtime layer
```

The source tables currently processed are:

```text
customers
products
orders
order_items
payments
```

---

### 4. Analytical modelling with dbt

dbt separates the warehouse into logical transformation layers.

```text
raw
 ↓
staging
 ↓
marts
```

The marts include:

* `dim_customers`
* `dim_products`
* `fact_orders`
* `mart_daily_revenue`
* `mart_top_products`
* `mart_customer_metrics`

The models provide both dimensional data and business-level aggregates for analytical workloads.

---

### 5. Data quality

Data quality is treated as a pipeline gate rather than a passive report.

The source database uses:

* Primary keys
* Foreign keys
* Check constraints

The dbt layer adds tests including:

* `not_null`
* `unique`
* `relationships`
* `accepted_values`

The Airflow pipeline executes `dbt test` after transformation.

A failed test prevents the downstream realtime compaction step from completing successfully.

---

### 6. Pipeline health monitoring

FinPulse includes a dedicated pipeline monitoring API:

```text
GET /pipeline/health
```

The endpoint checks the health of the major platform components:

```text
FastAPI
PostgreSQL Source
PostgreSQL Warehouse
Redis
Redpanda
Debezium CDC
Spark Streaming
Airflow
dbt Batch Layer
Order Generator
```

Each component reports:

* Status
* Message
* Check latency
* Component-specific details

The dashboard exposes this information through the **Pipeline Health** page.

This makes it possible to identify whether an issue is coming from the source database, CDC layer, broker, streaming layer, batch layer, warehouse, or serving layer.

---

## Dashboard

FinPulse includes a React + TypeScript analytics dashboard.

The frontend provides views for:

* Overview
* Revenue
* Products
* Customers
* Realtime Analytics
* Pipeline Health

The frontend stack includes:

| Technology   | Purpose                              |
| ------------ | ------------------------------------ |
| React        | UI framework                         |
| TypeScript   | Type-safe frontend development       |
| Vite         | Development server and build tooling |
| Tailwind CSS | UI styling                           |
| Recharts     | Data visualization                   |
| Lucide       | UI icons                             |

The dashboard communicates with the FastAPI serving layer through the `/api` frontend proxy.

---

## Technology stack

| Layer             | Technology                 | Purpose                        |
| ----------------- | -------------------------- | ------------------------------ |
| Source OLTP       | PostgreSQL 16              | Transactional source database  |
| CDC               | Debezium 2.7               | Captures PostgreSQL changes    |
| Event streaming   | Redpanda                   | Kafka-compatible event broker  |
| Stream processing | Spark Structured Streaming | Near-real-time aggregation     |
| Speed store       | Redis 7                    | Low-latency realtime serving   |
| Orchestration     | Apache Airflow             | Batch workflow orchestration   |
| Transformation    | dbt                        | SQL transformation and testing |
| Warehouse         | PostgreSQL 16              | Analytical warehouse           |
| API               | FastAPI                    | Data serving layer             |
| Frontend          | React + TypeScript         | Analytics dashboard            |
| Build tooling     | Vite                       | Frontend development/build     |
| Styling           | Tailwind CSS               | Frontend styling               |
| Visualisation     | Recharts                   | Charts and analytics           |
| Containers        | Docker Compose             | Local platform orchestration   |

---

## Data model

### Source database

The simulated OLTP system contains:

```text
customers
products
orders
order_items
payments
```

### Warehouse

The analytical PostgreSQL instance contains:

```text
raw
staging
marts
realtime
```

The primary analytical marts are:

```text
marts.dim_customers
marts.dim_products
marts.fact_orders
marts.mart_daily_revenue
marts.mart_top_products
marts.mart_customer_metrics
```

See [`docs/DATA_MODULE.md`](docs/DATA_MODULE.md) for the detailed data model.

---

## API

The FastAPI application exposes the following endpoints.

### System

```text
GET /health
GET /pipeline/health
```

### Batch layer

```text
GET /batch/daily-revenue
GET /batch/top-products
GET /batch/customers-summary
GET /batch/customer-metrics
GET /batch/customers-by-region
```

### Realtime layer

```text
GET /realtime/revenue
GET /realtime/top-products
```

### Lambda serving layer

```text
GET /lambda/today-revenue
```

Interactive API documentation is available through FastAPI's Swagger interface.

---

## Repository structure

```text
FinPulse/
├── airflow/
│   ├── dags/
│   │   ├── batch_etl_dag.py
│   │   └── bootstrap_cdc_dag.py
│   └── Dockerfile
│
├── dbt/
│   └── finpulse/
│       ├── models/
│       │   ├── staging/
│       │   └── marts/
│       ├── seeds/
│       ├── dbt_project.yml
│       └── profiles.yml
│
├── docker/
│   ├── init-source-db.sql
│   └── init-warehouse-db.sql
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BACKLOGS.md
│   ├── DATA_MODULE.md
│   └── RUNBOOK.md
│
├── scripts/
│   └── register_connector.sh
│
├── services/
│   ├── fastapi/
│   │   ├── app/
│   │   │   ├── routers/
│   │   │   │   ├── batch.py
│   │   │   │   ├── lambda_view.py
│   │   │   │   ├── pipeline.py
│   │   │   │   └── realtime.py
│   │   │   ├── db.py
│   │   │   └── main.py
│   │   └── requirements.txt
│   │
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── services/
│   │   │   ├── App.tsx
│   │   │   └── index.css
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── order_generator/
│       ├── generator.py
│       ├── Dockerfile
│       └── requirements.txt
│
├── streaming/
│   ├── debezium/
│   │   └── connector-source.json
│   ├── spark_jobs/
│   │   └── stream_processor.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── .env.example
├── .gitignore
├── docker-compose.yml
├── LICENSE
├── Makefile
└── README.md
```

---

## Running FinPulse locally

### Prerequisites

You will need:

* Docker
* Docker Compose
* Git
* Approximately 6 GB of available RAM for the platform

Check Docker:

```bash
docker --version
docker compose version
```

### Clone the repository

```bash
git clone <your-repository-url>
cd FinPulse
```

### Configure environment

```bash
cp .env.example .env
```

Review `.env` before starting the platform.

### Start the platform

```bash
make up
```

This starts the FinPulse infrastructure, including:

```text
PostgreSQL source
PostgreSQL warehouse
PostgreSQL Airflow metadata database
Airflow
Redpanda
Redpanda Console
Debezium
Redis
Spark Structured Streaming
FastAPI
Order Generator
```

The Airflow initialization container runs as part of startup and exits after completing initialization.

### Register the Debezium connector

```bash
make register-connector
```

The connector registration only needs to be performed after the platform is started, unless the connector needs to be recreated.

---

## Local interfaces

Once the platform is running:

| Component             | URL                          |
| --------------------- | ---------------------------- |
| FinPulse Dashboard    | `http://localhost:5173`      |
| FastAPI               | `http://localhost:8000`      |
| FastAPI Swagger       | `http://localhost:8000/docs` |
| Airflow               | `http://localhost:8080`      |
| Redpanda Console      | `http://localhost:8085`      |
| PostgreSQL Source     | `localhost:5432`             |
| PostgreSQL Warehouse  | `localhost:5433`             |
| Redis                 | `localhost:6379`             |
| Debezium Connect REST | `http://localhost:8083`      |

Airflow's local development credentials are:

```text
username: admin
password: admin
```

These credentials are intended for local development only.

---

## Verifying the pipeline

### Check containers

```bash
docker compose ps
```

### Check the API

```bash
curl http://localhost:8000/health
```

Expected:

```json
{
  "status": "ok",
  "service": "finpulse-api"
}
```

### Check complete pipeline health

```bash
curl http://localhost:8000/pipeline/health
```

A healthy platform should report:

```text
10 healthy
0 degraded
0 unhealthy
```

### Check realtime analytics

```bash
curl http://localhost:8000/realtime/revenue
```

### Check batch analytics

```bash
curl http://localhost:8000/batch/daily-revenue
```

### Check CDC connectors

```bash
curl http://localhost:8083/connectors
```

### Inspect Redpanda

Open:

```text
http://localhost:8085
```

and inspect the CDC topics and message flow.

---

## Operational documentation

Additional documentation is available in `docs/`:

| Document                                  | Purpose                                              |
| ----------------------------------------- | ---------------------------------------------------- |
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture and engineering decisions        |
| [`DATA_MODULE.md`](docs/DATA_MODULE.md)   | Source and warehouse data model                      |
| [`RUNBOOK.md`](docs/RUNBOOK.md)           | Startup, verification, troubleshooting, and recovery |
| [`BACKLOGS.md`](docs/BACKLOGS.md)         | Known limitations and future engineering work        |

---

## Engineering decisions and trade-offs

FinPulse intentionally contains several simplifications because it is designed to run locally on a single machine.

### Full batch extraction

The batch layer currently performs full-table extraction from the OLTP database.

This is simple and deterministic for the project's current data volume.

A production implementation would likely use incremental extraction, CDC-fed ingestion, or an equivalent scalable ingestion strategy.

### Single-node Redpanda

The development environment uses one Redpanda broker.

This is sufficient for local development but does not provide production-level broker redundancy.

### Simplified realtime calculations

The speed layer deliberately performs simpler calculations than the batch layer.

The goal is to demonstrate the Lambda trade-off:

```text
Speed layer → low latency
Batch layer → correctness
```

### Redis as a serving cache

Redis stores the latest realtime aggregates for fast API access.

The streaming layer also persists aggregates to the warehouse realtime staging tables so Redis is not the only representation of the data.

### Local development credentials

Services use simple credentials and localhost-exposed ports for development.

These should not be considered production security configurations.

---

## Current project status

FinPulse currently demonstrates a working end-to-end pipeline:

```text
                    DATA GENERATION
                          │
                          ▼
                   PostgreSQL OLTP
                          │
              ┌───────────┴───────────┐
              │                       │
             CDC                    Batch
              │                       │
              ▼                       ▼
          Debezium                 Airflow
              │                       │
              ▼                       ▼
          Redpanda                Warehouse
              │                       │
              ▼                       ▼
            Spark                    dbt
              │                       │
              ▼                       ▼
            Redis                   Marts
              │                       │
              └───────────┬───────────┘
                          ▼
                       FastAPI
                          │
                          ▼
                    React Dashboard
```

The platform also provides pipeline health monitoring across the major infrastructure components.

---

## Future work

Potential improvements are tracked in [`docs/BACKLOGS.md`](docs/BACKLOGS.md).

Examples include:

* Incremental batch extraction
* Dead-letter handling for malformed CDC events
* Stronger streaming fault tolerance
* Expanded automated testing
* CI/CD
* Authentication and authorization
* More advanced observability
* Cloud deployment
* Kubernetes deployment
* Production-grade secrets management
* Horizontal scaling

---

## License

This project is licensed under the MIT License. See [`LICENSE`](LICENSE).

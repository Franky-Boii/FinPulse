# FinPulse

**A real-time and batch e-commerce analytics platform built with a Lambda architecture.**

FinPulse is a Data Engineering project that takes e-commerce data from a PostgreSQL database, processes it in **real time and in batch**, and presents the results through a web dashboard.

It demonstrates how technologies such as **Debezium, Redpanda, Spark, Airflow, dbt, Redis, FastAPI, and React** can work together in one data platform.

---

## How does it work?

FinPulse has two main data paths.

### ⚡ Real-time path

When something changes in the source database:

```text
PostgreSQL
    ↓
Debezium
    ↓
Redpanda
    ↓
Spark Streaming
    ↓
Redis
    ↓
FastAPI
    ↓
Dashboard
```

This path provides **near-real-time analytics** such as revenue and top products.

### 📦 Batch path

The same source data is periodically processed for more complete analytical reporting:

```text
PostgreSQL
    ↓
Airflow
    ↓
Warehouse
    ↓
dbt
    ↓
Analytical Marts
    ↓
FastAPI
    ↓
Dashboard
```

The batch layer is treated as the **authoritative analytical view**.

---

## Architecture

```text
                    ┌──────────────────┐
                    │  E-commerce Data │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   PostgreSQL     │
                    │    OLTP Source   │
                    └────────┬─────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
             Real-time                  Batch
                │                         │
                ▼                         ▼
            Debezium                   Airflow
                │                         │
                ▼                         ▼
            Redpanda                 Warehouse
                │                         │
                ▼                         ▼
             Spark                       dbt
                │                         │
                ▼                         ▼
             Redis                     Marts
                │                         │
                └────────────┬────────────┘
                             │
                             ▼
                         FastAPI
                             │
                             ▼
                     React Dashboard
```

---

## What can FinPulse do?

### 📊 Analytics

* Daily revenue
* Top products
* Customer metrics
* Customer distribution by region
* Product performance

### ⚡ Real-time analytics

* Revenue by minute
* Real-time top products
* Streaming aggregates

### 🔎 Drill-down

You can select a product and investigate:

```text
Product
  ↓
Performance
  ↓
Sales history
  ↓
Recent orders
  ↓
Customers
```

### 🩺 Pipeline monitoring

FinPulse also has a **Pipeline Health** page that checks the major components of the platform.

---

## Technology stack

| Technology         | Purpose                         |
| ------------------ | ------------------------------- |
| PostgreSQL         | Source database and warehouse   |
| Debezium           | Change Data Capture             |
| Redpanda           | Event streaming                 |
| Spark              | Real-time processing            |
| Redis              | Real-time data serving          |
| Airflow            | Batch orchestration             |
| dbt                | Data transformation and testing |
| FastAPI            | API / serving layer             |
| React + TypeScript | Dashboard                       |
| Docker Compose     | Local infrastructure            |

---

## Running FinPulse

### 1. Clone the project

```bash
git clone <your-repository-url>
cd FinPulse
```

### 2. Configure environment

```bash
cp .env.example .env
```

### 3. Start the platform

```bash
make up
```

### 4. Register the CDC connector

```bash
make register-connector
```

### 5. Open the dashboard

```text
http://localhost:5173
```

---

## Useful interfaces

| Service          | URL                        |
| ---------------- | -------------------------- |
| Dashboard        | http://localhost:5173      |
| FastAPI          | http://localhost:8000      |
| API Docs         | http://localhost:8000/docs |
| Airflow          | http://localhost:8080      |
| Redpanda Console | http://localhost:8085      |

---

## Project structure

```text
FinPulse/
├── airflow/          # Batch orchestration
├── dbt/              # Data transformations
├── docker/           # Database initialization
├── docs/             # Project documentation
├── services/
│   ├── fastapi/      # API
│   ├── frontend/     # React dashboard
│   └── order_generator/
├── streaming/
│   ├── debezium/     # CDC configuration
│   └── spark_jobs/   # Streaming jobs
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## Documentation

For people who want to understand the project in more detail:

* [Architecture](docs/ARCHITECTURE.md) — how the platform works
* [Data Model](docs/DATA_MODULE.md) — source and warehouse data
* [Runbook](docs/RUNBOOK.md) — how to operate and troubleshoot it
* [Backlog](docs/BACKLOGS.md) — completed work and future improvements

---

## Why I built FinPulse

FinPulse was built to demonstrate practical Data Engineering skills across the full data lifecycle:

```text
Ingest
  ↓
Capture
  ↓
Stream
  ↓
Transform
  ↓
Store
  ↓
Serve
  ↓
Visualize
```

The project combines **batch processing, streaming, orchestration, data modelling, data quality, APIs, and analytics** into one working platform.

---

## License

MIT License

---

WTC-JVYEYCFT

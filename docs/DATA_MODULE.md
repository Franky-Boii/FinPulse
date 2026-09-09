# FinPulse Data Module

## 1. Purpose

FinPulse uses a relational e-commerce dataset to demonstrate an end-to-end data engineering platform.

The data model is intentionally simple enough to understand quickly while providing enough relationships and event volume to demonstrate:

- OLTP data ingestion
- Change Data Capture (CDC)
- Streaming analytics
- Batch extraction
- ELT transformations
- Dimensional modelling
- Data quality testing
- Analytical serving

The source system is PostgreSQL. Data is propagated through the platform using two complementary paths:

1. **Streaming path** — PostgreSQL → Debezium → Redpanda → Spark Structured Streaming → Redis
2. **Batch path** — PostgreSQL → Airflow → Raw Warehouse → dbt → Analytical Marts

---

# 2. High-Level Data Flow

```text
                    PostgreSQL OLTP
                         │
          ┌──────────────┴──────────────┐
          │                             │
          │ Batch                       │ CDC
          ▼                             ▼
       Airflow                       Debezium
          │                             │
          ▼                             ▼
    raw warehouse                    Redpanda
          │                             │
          ▼                             ▼
         dbt                          Spark
          │                             │
          ▼                             ▼
   Analytical marts                  Redis
          │                             │
          └──────────────┬──────────────┘
                         ▼
                    FastAPI API
                         │
                         ▼
                    React Dashboard

The batch layer provides the authoritative analytical history, while the streaming layer provides low-latency operational metrics.
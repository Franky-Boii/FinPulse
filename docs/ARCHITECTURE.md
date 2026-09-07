cd ~/Desktop/FinPulse

cat > docs/ARCHITECTURE.md <<'EOF'
# FinPulse Architecture

## 1. Overview

FinPulse is an end-to-end data engineering platform built around a simulated e-commerce workload.

The platform demonstrates how transactional data can be captured from an operational PostgreSQL database, streamed through a CDC pipeline for near-real-time processing, transformed through a batch ELT pipeline, and exposed through an API and analytics dashboard.

The architecture combines:

- PostgreSQL for OLTP source data
- Debezium for Change Data Capture (CDC)
- Redpanda as the Kafka-compatible event streaming platform
- Spark Structured Streaming for speed-layer processing
- Redis for low-latency realtime serving
- Airflow for batch orchestration
- dbt for SQL transformation and data quality testing
- PostgreSQL as the analytical warehouse
- FastAPI as the serving layer
- React + TypeScript for the analytics dashboard

The design follows a simplified **Lambda Architecture**:

```text
                         ┌─────────────────────────┐
                         │   Simulated E-commerce  │
                         │      Application        │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   PostgreSQL OLTP       │
                         │                         │
                         │ customers               │
                         │ products                │
                         │ orders                  │
                         │ order_items             │
                         │ payments                │
                         └────────────┬────────────┘
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                         │                         │
                         ▼                         ▼
                ┌─────────────────┐       ┌─────────────────┐
                │    Debezium     │       │    Airflow      │
                │      CDC        │       │   Batch ELT     │
                └────────┬────────┘       └────────┬────────┘
                         │                         │
                         ▼                         ▼
                ┌─────────────────┐       ┌─────────────────┐
                │    Redpanda     │       │   Raw Warehouse │
                │ Kafka-compatible│       │      Layer      │
                │     broker      │       └────────┬────────┘
                └────────┬────────┘                │
                         │                         ▼
                         ▼                  ┌─────────────────┐
                ┌─────────────────┐         │       dbt       │
                │ Spark Structured│         │ staging / int / │
                │    Streaming   │         │     marts       │
                └────────┬────────┘         └────────┬────────┘
                         │                           │
                         ▼                           ▼
                ┌─────────────────┐         ┌─────────────────┐
                │      Redis      │         │   PostgreSQL    │
                │  Speed Layer    │         │   Warehouse     │
                └────────┬────────┘         └────────┬────────┘
                         │                           │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │     FastAPI      │
                              │  Serving Layer   │
                              └────────┬─────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ React Dashboard  │
                              │                  │
                              │ Overview         │
                              │ Revenue          │
                              │ Products         │
                              │ Customers        │
                              │ Realtime         │
                              │ Pipeline Health  │
                              └──────────────────┘
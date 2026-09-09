# FinPulse Architecture

## 1. Overview

FinPulse is an e-commerce analytics platform that processes data in two ways:

1. **Real time** — to provide fast, recent analytics.
2. **Batch** — to build reliable, complete analytical data.

This is known as a **Lambda architecture**.

```text
                         ┌─────────────────────┐
                         │   PostgreSQL        │
                         │   Source Database   │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
             REAL-TIME PATH                    BATCH PATH
                    │                               │
                Debezium                         Airflow
                    │                               │
                Redpanda                       Warehouse
                    │                               │
            Spark Streaming                       dbt
                    │                               │
                  Redis                     Analytical Marts
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                              ┌───────────┐
                              │ FastAPI   │
                              │ API       │
                              └─────┬─────┘
                                    │
                                    ▼
                              ┌───────────┐
                              │  React    │
                              │ Dashboard │
                              └───────────┘
```

---

## 2. The Source Database

FinPulse starts with a PostgreSQL database containing e-commerce data.

The main tables are:

| Table         | What it contains                |
| ------------- | ------------------------------- |
| `customers`   | Customer information            |
| `products`    | Products being sold             |
| `orders`      | Customer orders                 |
| `order_items` | Products included in each order |
| `payments`    | Payment information             |

This database represents the operational system where new orders, customers, payments, and other changes happen.

---

# 3. Real-Time Data Path

The real-time path is designed to process changes quickly.

```text
PostgreSQL
    ↓
Debezium
    ↓
Redpanda
    ↓
Spark Structured Streaming
    ↓
Redis
    ↓
FastAPI
    ↓
React Dashboard
```

### Debezium

**Debezium** monitors the PostgreSQL database for changes.

Instead of repeatedly asking the database:

> "What changed?"

Debezium captures database changes as they happen.

This is called **Change Data Capture (CDC)**.

---

### Redpanda

Debezium sends these changes to **Redpanda**.

Redpanda acts as the event streaming platform.

The data is organised into topics, for example:

```text
finpulse.public.orders
finpulse.public.payments
finpulse.public.order_items
```

Each topic contains events describing changes to the corresponding table.

---

### Spark Structured Streaming

**Spark Structured Streaming** reads events from Redpanda and processes them.

For example, FinPulse can calculate:

* Revenue over recent time windows
* Units sold
* Top products
* Other streaming aggregates

Spark then writes the resulting real-time metrics to Redis.

---

### Redis

**Redis** stores the latest streaming results so they can be retrieved quickly.

For example:

```text
finpulse:realtime:revenue:latest
finpulse:realtime:revenue:series
finpulse:realtime:top_products
```

Redis is useful here because the dashboard needs fast access to frequently changing values.

---

# 4. Batch Data Path

The batch path is designed to produce reliable analytical data.

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
React Dashboard
```

### Airflow

**Apache Airflow** controls the batch pipeline.

It determines:

* What should run
* In what order it should run
* When it should run
* Whether a task succeeded or failed

The main batch DAG is:

```text
finpulse_batch_etl
```

---

### Data Warehouse

FinPulse uses a PostgreSQL database as its analytical warehouse.

The warehouse contains layers that separate raw data from transformed analytical data.

The main layers are:

```text
Raw Data
   ↓
Staging
   ↓
Marts
```

This makes the transformation process easier to understand and maintain.

---

### dbt

**dbt** transforms the warehouse data into analytical models.

For example:

```text
raw.orders
      +
raw.order_items
      +
raw.payments
      ↓
marts.fact_orders
```

dbt is also used for data testing and modelling.

---

# 5. Analytical Marts

The final analytical models are stored in the `marts` schema.

Important models include:

| Model                   | Purpose                     |
| ----------------------- | --------------------------- |
| `dim_customers`         | Customer information        |
| `dim_products`          | Product information         |
| `fact_orders`           | Order-level analytical data |
| `mart_customer_metrics` | Customer purchasing metrics |
| `mart_daily_revenue`    | Daily revenue metrics       |
| `mart_top_products`     | Product performance         |

These models are designed to make analytics easier for the API and dashboard.

---

# 6. FastAPI Serving Layer

FastAPI sits between the data platform and the frontend.

```text
Data Platform
     ↓
   FastAPI
     ↓
  Frontend
```

The API provides endpoints for retrieving:

* Revenue
* Customers
* Products
* Orders
* Real-time metrics
* Pipeline health

For example:

```text
GET /batch/daily-revenue
GET /batch/top-products
GET /batch/customer-metrics
GET /batch/products/{product_id}
GET /batch/products/{product_id}/orders
```

The frontend does not directly query PostgreSQL or Redis.

Instead:

```text
React → FastAPI → Data Store
```

This keeps the frontend separate from the underlying data infrastructure.

---

# 7. React Dashboard

The React frontend provides a simple interface for exploring the data.

Main areas include:

* Overview
* Revenue
* Customers
* Products
* Product Details
* Realtime
* Pipeline Health

Users can also drill down into individual products.

For example:

```text
Products
   ↓
Select Product
   ↓
Product Details
   ↓
Sales History
   ↓
Recent Orders
```

---

# 8. Why Use Two Data Paths?

The two paths solve different problems.

### Real-time path

The real-time path is optimised for **speed**.

It answers questions such as:

> "What is happening right now?"

Examples:

* Current revenue
* Recent revenue trends
* Current top products

### Batch path

The batch path is optimised for **completeness and consistency**.

It answers questions such as:

> "What does the complete analytical dataset tell us?"

Examples:

* Daily revenue
* Customer metrics
* Product performance
* Historical reporting

The two approaches complement each other.

---

# 9. Why Lambda Architecture?

FinPulse uses Lambda architecture because it demonstrates both major approaches to data processing.

```text
                 ┌── Real-Time Processing
                 │
Source Data ─────┤
                 │
                 └── Batch Processing
```

This allows the project to demonstrate:

* Change Data Capture
* Event streaming
* Stream processing
* Batch processing
* Data warehousing
* Data transformation
* Data orchestration
* API development
* Data visualization

It also shows how these technologies can work together as one data platform.

---

# 10. Running Everything Locally

FinPulse uses Docker Compose to run the infrastructure locally.

The main services include:

```text
PostgreSQL
Debezium
Redpanda
Spark
Redis
Airflow
dbt
FastAPI
React
```

This allows the complete platform to be developed and tested on one machine.

---

# 11. Simple Data Flow

The easiest way to understand FinPulse is:

```text
1. Data is created
       ↓
2. PostgreSQL stores it
       ↓
3. Debezium captures changes
       ↓
4. Redpanda streams the changes
       ↓
5. Spark processes real-time data
       ↓
6. Redis stores fast real-time results

Meanwhile:

1. PostgreSQL data
       ↓
2. Airflow runs the batch pipeline
       ↓
3. Data enters the warehouse
       ↓
4. dbt transforms the data
       ↓
5. Analytical marts are created

Finally:

Real-Time Data ──┐
                 ├──→ FastAPI → React Dashboard
Batch Data ──────┘
```

---

## 12. Architecture Summary

FinPulse can be summarised as:

| Layer           | Technology | Responsibility              |
| --------------- | ---------- | --------------------------- |
| Source          | PostgreSQL | Store operational data      |
| CDC             | Debezium   | Capture database changes    |
| Streaming       | Redpanda   | Transport events            |
| Processing      | Spark      | Process streaming data      |
| Real-time Store | Redis      | Serve fast-changing metrics |
| Orchestration   | Airflow    | Run batch workflows         |
| Transformation  | dbt        | Build analytical models     |
| Warehouse       | PostgreSQL | Store analytical data       |
| API             | FastAPI    | Serve data to applications  |
| Frontend        | React      | Display analytics           |
| Infrastructure  | Docker     | Run the platform locally    |

The overall architecture is therefore:

```text
                 FINPULSE

              SOURCE DATA
                  │
             PostgreSQL
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
      DEBEZIUM            AIRFLOW
        │                   │
     REDPANDA           WAREHOUSE
        │                   │
      SPARK                 dbt
        │                   │
      REDIS                MARTS
        │                   │
        └─────────┬─────────┘
                  │
               FASTAPI
                  │
                REACT
                  │
              DASHBOARD
```

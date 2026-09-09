# FinPulse Architecture

## 1. Overview

FinPulse is an end-to-end data engineering platform built around a simulated e-commerce workload.

The platform demonstrates how transactional data can be captured from an operational PostgreSQL database, streamed through a Change Data Capture (CDC) pipeline for near-real-time processing, transformed through a batch ELT pipeline, and exposed through an API and analytics dashboard.

The architecture combines:

* PostgreSQL for OLTP source data
* Debezium for Change Data Capture (CDC)
* Redpanda as the Kafka-compatible event streaming platform
* Apache Spark Structured Streaming for speed-layer processing
* Redis for low-latency realtime serving
* Apache Airflow for batch orchestration
* dbt for SQL transformation and data quality testing
* PostgreSQL as the analytical warehouse
* FastAPI as the serving layer
* React + TypeScript for the analytics dashboard

The design follows a simplified **Lambda Architecture** with independent batch and speed paths.

---

# 2. High-Level Architecture

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
                │     Broker      │       └────────┬────────┘
                └────────┬────────┘                │
                         │                         ▼
                         ▼                  ┌─────────────────┐
                ┌─────────────────┐         │       dbt       │
                │ Apache Spark    │         │                 │
                │ Structured      │         │ staging         │
                │ Streaming       │         │ intermediate    │
                └────────┬────────┘         │ marts           │
                         │                  │ monitoring      │
                         ▼                  └────────┬────────┘
                ┌─────────────────┐                  │
                │      Redis      │                  ▼
                │  Speed Layer    │         ┌─────────────────┐
                └────────┬────────┘         │   PostgreSQL    │
                         │                  │   Warehouse     │
                         │                  └────────┬────────┘
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
```

---

# 3. Architectural Principles

FinPulse is designed around several core data engineering principles.

## 3.1 Separation of workloads

Transactional workloads remain in the source PostgreSQL database while analytical workloads are handled by a separate PostgreSQL warehouse.

This prevents analytical transformations from directly competing with the operational application database.

## 3.2 Change Data Capture

Instead of repeatedly polling the source database for changes, Debezium captures PostgreSQL changes from the logical replication stream.

This provides an event-driven path for realtime processing.

## 3.3 Independent batch and speed layers

The speed layer provides low-latency operational metrics.

The batch layer provides authoritative analytical results.

This separation demonstrates the core concept behind Lambda Architecture.

## 3.4 Transformation as code

Business transformations are implemented using dbt SQL models instead of manually maintained SQL scripts.

This provides:

* dependency management
* reusable models
* automated testing
* version-controlled transformations
* clear lineage

## 3.5 Orchestration

Airflow coordinates the scheduled batch pipeline.

The pipeline is divided into logical tasks so failures can be identified and recovered more easily.

## 3.6 Data quality

dbt tests validate important analytical assumptions including:

* uniqueness
* not-null constraints
* accepted categorical values
* referential relationships

## 3.7 Observability

FinPulse exposes a dedicated pipeline health endpoint that checks the operational state of the main platform components.

---

# 4. Source OLTP Layer

The source database is PostgreSQL 16.

Database:

```text
ecommerce
```

Container:

```text
finpulse-postgres-source
```

Host port:

```text
5432
```

The source database represents the operational system of record for the simulated e-commerce application.

The source schema contains five primary tables:

```text
customers
products
orders
order_items
payments
```

---

# 5. Source Data Model

## 5.1 customers

The `customers` table stores customer records.

### Grain

One row represents one customer.

### Important columns

| Column        | Description                 |
| ------------- | --------------------------- |
| `customer_id` | Primary customer identifier |
| `full_name`   | Customer name               |
| `email`       | Customer email address      |
| `country`     | Customer country            |
| `signup_date` | Customer registration date  |
| `created_at`  | Record creation timestamp   |
| `updated_at`  | Last update timestamp       |

### Constraints

* `customer_id` is the primary key.
* `email` is unique.
* Required customer attributes are `NOT NULL`.

---

## 5.2 products

The `products` table stores the product catalogue.

### Grain

One row represents one product.

### Important columns

| Column         | Description               |
| -------------- | ------------------------- |
| `product_id`   | Product identifier        |
| `product_name` | Product name              |
| `category`     | Product category          |
| `unit_price`   | Current product price     |
| `created_at`   | Record creation timestamp |
| `updated_at`   | Last update timestamp     |

---

## 5.3 orders

The `orders` table stores customer orders.

### Grain

One row represents one order.

### Important columns

| Column         | Description                    |
| -------------- | ------------------------------ |
| `order_id`     | Primary order identifier       |
| `customer_id`  | Customer who placed the order  |
| `order_status` | Current order lifecycle status |
| `order_ts`     | Order timestamp                |
| `created_at`   | Record creation timestamp      |
| `updated_at`   | Last update timestamp          |

Supported statuses are:

```text
placed
paid
shipped
cancelled
```

Relationship:

```text
orders.customer_id
        │
        ▼
customers.customer_id
```

The database enforces this relationship using a foreign key.

---

# 6. order_items

The `order_items` table represents individual products contained within an order.

### Grain

One row represents one product line item within an order.

### Important columns

| Column          | Description                |
| --------------- | -------------------------- |
| `order_item_id` | Line-item identifier       |
| `order_id`      | Parent order               |
| `product_id`    | Product purchased          |
| `quantity`      | Number of units            |
| `unit_price`    | Price per unit             |
| `line_total`    | Calculated line-item value |
| `created_at`    | Creation timestamp         |

The database calculates `line_total` using:

```text
quantity × unit_price
```

The source database also enforces:

```text
quantity > 0
```

Relationships:

```text
order_items.order_id
        │
        ▼
orders.order_id


order_items.product_id
        │
        ▼
products.product_id
```

---

# 7. Payments

The `payments` table stores payment transactions.

### Grain

One row represents one payment transaction.

### Important columns

| Column           | Description                  |
| ---------------- | ---------------------------- |
| `payment_id`     | Payment identifier           |
| `order_id`       | Associated order             |
| `amount`         | Payment amount               |
| `payment_method` | Payment method               |
| `payment_status` | Payment state                |
| `paid_at`        | Successful payment timestamp |
| `created_at`     | Creation timestamp           |

Supported payment methods:

```text
card
eft
wallet
```

Supported payment statuses:

```text
pending
success
failed
```

Relationship:

```text
payments.order_id
        │
        ▼
orders.order_id
```

---

# 8. PostgreSQL CDC Configuration

The source database is configured for logical replication.

All CDC tables use:

```sql
REPLICA IDENTITY FULL
```

This allows Debezium to receive complete before/after row images for UPDATE and DELETE operations.

The PostgreSQL publication is:

```text
finpulse_publication
```

The publication includes:

```text
customers
products
orders
order_items
payments
```

Debezium uses PostgreSQL's `pgoutput` logical decoding plugin.

The logical replication flow is:

```text
PostgreSQL
    │
    ▼
Write-Ahead Log
    │
    ▼
Logical Replication
    │
    ▼
Debezium
```

---

# 9. Change Data Capture Layer

Debezium provides the CDC layer.

Container:

```text
finpulse-debezium
```

REST API:

```text
localhost:8083
```

Connector:

```text
finpulse-source-connector
```

Debezium captures changes from the PostgreSQL publication and publishes them to Redpanda.

The general flow is:

```text
PostgreSQL WAL
      │
      ▼
  Debezium
      │
      ▼
 Redpanda
```

CDC topics follow the naming convention:

```text
finpulse.public.<table>
```

Examples:

```text
finpulse.public.customers
finpulse.public.products
finpulse.public.orders
finpulse.public.order_items
finpulse.public.payments
```

CDC events contain the information needed to identify:

* the affected table
* the operation
* the previous row state where available
* the new row state where available
* event metadata

---

# 10. Redpanda Streaming Layer

Redpanda provides the Kafka-compatible event streaming backbone.

Container:

```text
finpulse-redpanda
```

Internal Kafka endpoint:

```text
redpanda:29092
```

External Kafka endpoint:

```text
localhost:9092
```

Redpanda acts as a decoupling layer between CDC producers and downstream streaming consumers.

The architecture therefore becomes:

```text
PostgreSQL
     │
     ▼
 Debezium
     │
     ▼
 Redpanda
     │
     ├───────────────┐
     │               │
     ▼               ▼
   Spark          Other
 Streaming       Consumers
```

The current deployment is a single-node development environment.

This keeps the project lightweight enough to run locally while still demonstrating event streaming architecture.

---

# 11. Redpanda Console

Redpanda Console provides a web interface for inspecting the streaming platform.

Container:

```text
finpulse-redpanda-console
```

Host interface:

```text
http://localhost:8085
```

It can be used to inspect:

* Kafka topics
* partitions
* messages
* consumer activity
* broker information

---

# 12. Spark Structured Streaming

Apache Spark Structured Streaming implements the FinPulse speed layer.

Container:

```text
finpulse-spark-stream
```

Spark connects to Redpanda using:

```text
redpanda:29092
```

Spark produces realtime analytical results from CDC events.

There are two main streaming computations.

---

# 13. Realtime Revenue Processing

Payment events are used to calculate recent revenue activity.

The streaming logic focuses on successful payment events.

Revenue is aggregated into one-minute event-time windows.

The processing configuration uses:

```text
Event-time processing
1-minute tumbling windows
2-minute watermark
```

The resulting metrics include:

```text
window_start
order_count
revenue
```

Conceptually:

```text
Payment CDC events
        │
        ▼
Filter successful payments
        │
        ▼
Event-time windows
        │
        ▼
1-minute aggregation
        │
        ▼
Realtime revenue
```

This provides a low-latency view of payment activity.

---

# 14. Realtime Top Products

Spark also processes order-item events to calculate recent product activity.

The processing flow is:

```text
Order item CDC events
        │
        ▼
Filter insert events
        │
        ▼
Join product information
        │
        ▼
5-minute windows
        │
        ▼
Aggregate product activity
```

The output contains:

```text
window_start
product_id
product_name
units_sold
revenue
```

This provides a near-real-time view of which products are generating activity.

---

# 15. Redis Speed Layer

Redis provides low-latency serving for streaming results.

Container:

```text
finpulse-redis
```

Port:

```text
6379
```

Redis is used because the dashboard and API need fast access to the latest streaming aggregates without querying Spark or the event broker directly.

Realtime revenue is stored using:

```text
finpulse:realtime:revenue:latest
```

A revenue series is maintained using:

```text
finpulse:realtime:revenue:series
```

Realtime product rankings are stored using:

```text
finpulse:realtime:top_products
```

The serving flow is:

```text
Spark
  │
  ▼
Redis
  │
  ▼
FastAPI
  │
  ▼
Dashboard
```

---

# 16. Analytical Warehouse

The analytical warehouse is a separate PostgreSQL 16 database.

Database:

```text
warehouse
```

Container:

```text
finpulse-postgres-warehouse
```

Host port:

```text
5433
```

The warehouse separates analytical workloads from the OLTP database.

The warehouse contains the following major schemas:

```text
raw
staging
marts
realtime
```

Additional schemas such as `monitoring` may be created by dbt for operational monitoring models.

---

# 17. Warehouse Layer Architecture

The warehouse follows this logical progression:

```text
                 Source PostgreSQL
                        │
                        ▼
                 ┌────────────┐
                 │    raw     │
                 └─────┬──────┘
                       │
                       ▼
                 ┌────────────┐
                 │  staging   │
                 │    dbt     │
                 └─────┬──────┘
                       │
                       ▼
                 ┌────────────┐
                 │intermediate│
                 │    dbt     │
                 └─────┬──────┘
                       │
                       ▼
                 ┌────────────┐
                 │   marts    │
                 │    dbt     │
                 └────────────┘


        Spark
          │
          ▼
     ┌───────────┐
     │ realtime  │
     └───────────┘
```

The batch and realtime warehouse paths are deliberately separated.

---

# 18. Raw Warehouse Layer

The `raw` schema contains extracted copies of the source OLTP tables.

Tables:

```text
raw.customers
raw.products
raw.orders
raw.order_items
raw.payments
```

Airflow extracts the source tables and loads them into this layer.

The raw layer acts as the input boundary for dbt.

The raw data is intentionally kept close to the source structure so downstream transformations can be reproduced.

---

# 19. dbt Project

The dbt project is located at:

```text
dbt/finpulse
```

Project name:

```text
finpulse
```

dbt is responsible for:

* SQL transformations
* dependency management
* analytical modelling
* data quality testing
* monitoring models
* reusable seeds

The model directories are:

```text
models/
├── staging/
├── intermediate/
├── marts/
└── monitoring/
```

---

# 20. dbt Materialization Strategy

FinPulse uses the following materialization strategy:

| Model Layer  | Materialization | Target Schema |
| ------------ | --------------- | ------------- |
| Staging      | View            | `staging`     |
| Intermediate | View            | `staging`     |
| Marts        | Table           | `marts`       |
| Monitoring   | View            | `monitoring`  |
| Seeds        | Table           | `staging`     |

This approach keeps lightweight transformations as views while persisting analytical marts as physical tables.

---

# 21. dbt Staging Layer

The staging layer contains five models:

```text
stg_customers
stg_products
stg_orders
stg_order_items
stg_payments
```

Staging models primarily perform:

* type casting
* whitespace cleanup
* case normalisation
* field standardisation
* simple derived fields

The staging layer intentionally avoids complex business logic.

---

# 22. stg_customers

The customer staging model reads from:

```text
raw.customers
```

Transformations include:

```text
TRIM(full_name)
LOWER(TRIM(email))
TRIM(country)
```

The model preserves customer timestamps and signup information.

---

# 23. stg_products

The product staging model reads from:

```text
raw.products
```

Transformations include:

```text
TRIM(product_name)
TRIM(category)
CAST(unit_price AS NUMERIC)
```

---

# 24. stg_orders

The order staging model reads from:

```text
raw.orders
```

Transformations include:

```text
LOWER(TRIM(order_status))
CAST(order_ts AS DATE) AS order_date
```

The derived `order_date` is later used for daily analytical aggregation.

---

# 25. stg_order_items

The order-item staging model reads from:

```text
raw.order_items
```

Monetary values are explicitly cast to numeric types.

The model retains:

```text
order_item_id
order_id
product_id
quantity
unit_price
line_total
created_at
```

---

# 26. stg_payments

The payment staging model reads from:

```text
raw.payments
```

Transformations include:

```text
CAST(amount AS NUMERIC)
LOWER(TRIM(payment_method))
LOWER(TRIM(payment_status))
```

---

# 27. dbt Intermediate Layer

The intermediate layer contains two models:

```text
int_orders_enriched
int_customer_orders
```

These models contain reusable business transformations that feed multiple marts.

---

# 28. int_orders_enriched

`int_orders_enriched` combines:

```text
stg_orders
stg_customers
stg_order_items
stg_payments
```

The model aggregates order items before joining them to orders.

It calculates:

```text
units_sold
order_value
successful_payment_amount
```

Where:

```text
units_sold = SUM(order_items.quantity)
```

and:

```text
order_value = SUM(order_items.line_total)
```

Successful payment amount is calculated using payment records where:

```text
payment_status = 'success'
```

### Grain

The model has:

```text
one row per order
```

This is an important modelling boundary because multiple order items and payments are reduced to the order level before downstream fact and mart models consume the result.

---

# 29. int_customer_orders

`int_customer_orders` aggregates order activity by customer.

Metrics include:

```text
order_count
total_order_value
total_units_sold
first_order_date
latest_order_date
```

### Grain

The model has:

```text
one row per customer with order activity
```

This model feeds the customer metrics mart.

---

# 30. dbt Marts

The marts layer contains seven analytical models:

```text
dim_customers
dim_products
fact_orders
fact_payments
mart_customer_metrics
mart_daily_revenue
mart_top_products
```

These models are materialized as PostgreSQL tables in the `marts` schema.

---

# 31. dim_customers

`dim_customers` is the analytical customer dimension.

It is built from:

```text
stg_customers
seed_country_region
```

The model enriches each customer with a geographic region.

If a country is not found in the region mapping, the model assigns:

```text
Unknown
```

### Grain

```text
one row per customer
```

---

# 32. dim_products

`dim_products` is the analytical product dimension.

It is derived from:

```text
stg_products
```

### Grain

```text
one row per product
```

---

# 33. fact_orders

`fact_orders` is the primary order-level analytical fact table.

It is derived from:

```text
int_orders_enriched
```

### Grain

```text
one row per order
```

The fact contains:

```text
order_id
customer_id
customer_name
customer_email
country
order_status
order_ts
order_date
units_sold
order_value
successful_payment_amount
```

This model provides the main analytical representation of order activity.

---

# 34. fact_payments

`fact_payments` represents payment-level activity.

It is derived from:

```text
stg_payments
```

### Grain

```text
one row per payment
```

The fact contains:

```text
payment_id
order_id
amount
payment_method
payment_status
paid_at
created_at
```

---

# 35. mart_customer_metrics

`mart_customer_metrics` provides customer-level purchasing metrics.

It combines:

```text
dim_customers
int_customer_orders
```

Metrics include:

```text
order_count
total_order_value
total_units_sold
first_order_date
latest_order_date
```

Customers with no orders are retained.

Their numerical purchasing metrics are represented as zero.

### Grain

```text
one row per customer
```

---

# 36. mart_daily_revenue

`mart_daily_revenue` provides daily business performance metrics.

Metrics include:

```text
order_count
revenue
units_sold
average_order_value
```

The model groups data by:

```text
order_date
```

### Revenue definition

Batch revenue is calculated from order line-item value:

```text
SUM(order_value)
```

However, cancelled orders are excluded.

The logic excludes:

```text
cancelled
canceled
```

Therefore:

```text
Batch Revenue
=
SUM(order_value)
for non-cancelled orders
```

### Important distinction

The batch revenue definition is different from the realtime revenue definition.

The batch layer uses:

```text
non-cancelled order value
```

The realtime speed layer uses:

```text
successful payment events
```

This distinction should be understood when comparing batch and realtime metrics.

---

# 37. mart_top_products

`mart_top_products` calculates product-level sales performance.

It combines:

```text
stg_order_items
dim_products
fact_orders
```

Cancelled orders are excluded.

Metrics include:

```text
units_sold
revenue
```

### Grain

```text
one row per product
```

Revenue is based on:

```text
SUM(order_items.line_total)
```

for non-cancelled orders.

---

# 38. dbt Monitoring Models

The monitoring layer contains:

```text
source_row_counts
source_freshness
```

These models provide operational visibility into the raw source data.

---

# 39. source_row_counts

This model calculates current row counts for:

```text
customers
products
orders
order_items
payments
```

The output contains:

```text
table_name
row_count
checked_at
```

This can be used to identify:

* unexpected drops in data volume
* unexpected growth
* stalled ingestion
* missing source tables

---

# 40. source_freshness

This model calculates source freshness.

For each monitored table it records:

```text
table_name
table_type
latest_source_timestamp
checked_at
source_age
```

Source tables are classified as either:

```text
transactional
reference
```

The model uses the appropriate timestamp column for each source.

For example:

```text
customers  → updated_at
products   → updated_at
orders     → updated_at
order_items → created_at
payments   → created_at
```

---

# 41. dbt Data Quality Tests

FinPulse uses dbt tests to validate important data assumptions.

Tests include:

```text
not_null
unique
accepted_values
relationships
```

---

# 42. Uniqueness Tests

Uniqueness tests are applied to important identifiers.

Examples:

```text
customer_id
product_id
order_id
order_item_id
payment_id
```

These tests help detect duplicate analytical records.

---

# 43. Not-Null Tests

Required fields are tested for null values.

Examples include:

```text
customer_id
product_id
order_id
email
country
order_date
amount
payment_status
```

---

# 44. Accepted-Value Tests

Controlled categorical fields are validated.

Order statuses:

```text
cancelled
paid
placed
shipped
```

Payment statuses:

```text
failed
pending
success
```

Payment methods:

```text
card
eft
wallet
```

---

# 45. Relationship Tests

dbt relationship tests validate logical foreign-key relationships in the analytical layer.

Examples:

```text
stg_orders.customer_id
        ↓
stg_customers.customer_id
```

```text
stg_order_items.order_id
        ↓
stg_orders.order_id
```

```text
stg_order_items.product_id
        ↓
stg_products.product_id
```

```text
stg_payments.order_id
        ↓
stg_orders.order_id
```

Analytical mart relationships are also tested.

---

# 46. Realtime Warehouse Layer

In addition to Redis, Spark writes realtime results into PostgreSQL warehouse tables.

The realtime schema contains:

```text
realtime.revenue_by_minute_staging
realtime.revenue_by_minute
realtime.top_products_5min
```

---

# 47. revenue_by_minute_staging

This is an append-oriented staging table for realtime revenue results.

Columns:

```text
window_start
order_count
revenue
ingested_at
```

The table allows streaming output to be collected before warehouse compaction.

---

# 48. revenue_by_minute

This is the compacted realtime revenue table.

Columns:

```text
window_start
order_count
revenue
updated_at
```

Primary key:

```text
window_start
```

An index is also maintained on:

```text
window_start DESC
```

---

# 49. top_products_5min

This table stores five-minute product performance windows.

Columns:

```text
window_start
product_id
product_name
units_sold
revenue
ingested_at
```

Primary key:

```text
(window_start, product_id)
```

Indexes support:

```text
window_start DESC
revenue DESC
```

---

# 50. Realtime Warehouse Compaction

Streaming systems naturally produce incremental results.

FinPulse therefore uses an hourly Airflow task to compact realtime revenue staging data.

The flow is:

```text
Spark
   │
   ▼
revenue_by_minute_staging
   │
   │ hourly Airflow task
   ▼
revenue_by_minute
```

The compaction process retains the latest result for each realtime window.

This creates a cleaner warehouse representation while Redis continues to serve low-latency realtime results.

---

# 51. Airflow Batch Pipeline

Airflow orchestrates the batch ELT workflow.

The main DAG is:

```text
batch_etl_dag
```

The DAG is configured to run hourly.

Catchup is disabled.

The main pipeline is:

```text
PostgreSQL OLTP
       │
       ▼
Extract source tables
       │
       ▼
Raw warehouse
       │
       ▼
dbt seed
       │
       ▼
dbt run
       │
       ▼
dbt test
       │
       ▼
Realtime compaction
```

---

# 52. Batch Extraction

The following source tables are extracted:

```text
customers
products
orders
order_items
payments
```

The extracted records are loaded into the corresponding `raw` warehouse tables.

The extraction process provides the input for dbt.

---

# 53. dbt Seed

The dbt pipeline executes a seed operation.

The project uses a country-to-region mapping seed:

```text
seed_country_region
```

This mapping is used by:

```text
dim_customers
```

to enrich customers with a region.

---

# 54. dbt Run

The batch pipeline executes the dbt transformation graph.

The dependency chain follows:

```text
raw
 │
 ▼
staging
 │
 ▼
intermediate
 │
 ▼
marts
```

Monitoring models are also generated by dbt.

---

# 55. dbt Test

After transformations, dbt tests are executed.

The purpose is to prevent invalid analytical data from silently reaching the serving layer.

The test layer checks:

* uniqueness
* nullability
* accepted values
* relationships

---

# 56. Batch vs Speed Layer

The FinPulse architecture deliberately provides two different processing paths.

## Batch layer

Primary technologies:

```text
Airflow
dbt
PostgreSQL
```

Purpose:

* historical analytics
* authoritative reporting
* analytical transformations
* data quality validation
* warehouse modelling

## Speed layer

Primary technologies:

```text
Debezium
Redpanda
Spark Structured Streaming
Redis
```

Purpose:

* low-latency metrics
* recent activity
* streaming analytics
* realtime dashboard updates

---

# 57. Revenue Semantics

One of the most important architectural distinctions in FinPulse is the definition of revenue across the two processing paths.

### Batch revenue

Batch revenue is calculated from:

```text
order line-item value
```

and excludes cancelled orders.

Conceptually:

```text
Non-cancelled order
       │
       ▼
Order items
       │
       ▼
line_total
       │
       ▼
order_value
       │
       ▼
Daily revenue
```

### Realtime revenue

Realtime revenue is calculated from:

```text
successful payment events
```

Conceptually:

```text
Payment CDC event
       │
       ▼
payment_status = success
       │
       ▼
1-minute window
       │
       ▼
Realtime revenue
```

These metrics can therefore differ temporarily or semantically.

The Lambda serving layer presents both perspectives.

---

# 58. FastAPI Serving Layer

The serving API is located at:

```text
services/fastapi
```

Container:

```text
finpulse-api
```

Host port:

```text
8000
```

FastAPI provides a unified interface over the batch, speed, and monitoring layers.

---

# 59. API Endpoint Groups

Main endpoint groups:

```text
/health
/batch/*
/realtime/*
/lambda/*
/pipeline/*
```

---

# 60. Batch API

Batch endpoints include:

```text
GET /batch/daily-revenue
GET /batch/top-products
GET /batch/customers-summary
GET /batch/customer-metrics
GET /batch/customers-by-region
```

These endpoints primarily query analytical warehouse marts.

---

# 61. Realtime API

Realtime endpoints include:

```text
GET /realtime/revenue
GET /realtime/top-products
```

These endpoints read streaming results from Redis.

The goal is to avoid forcing dashboard clients to communicate directly with Spark, Redpanda, or Redis.

---

# 62. Lambda API

The Lambda view is exposed through:

```text
GET /lambda/today-revenue
```

This endpoint provides:

```text
batch_layer
speed_layer_latest_minute
merged_estimate
```

The batch layer remains authoritative for historical analytical reporting.

The speed layer provides more recent information.

The endpoint therefore demonstrates how batch and streaming results can be exposed together.

---

# 63. Pipeline Health API

Pipeline health is exposed through:

```text
GET /pipeline/health
```

The endpoint checks ten components:

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

Each check provides:

```text
name
status
message
latency_ms
details
```

Possible statuses are:

```text
healthy
degraded
unhealthy
```

The response also contains aggregate counts.

---

# 64. Pipeline Health Architecture

The operational monitoring flow is:

```text
                  ┌──────────────────┐
                  │    FastAPI       │
                  │ /pipeline/health │
                  └────────┬─────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   PostgreSQL          Redpanda          Debezium
   Source/Warehouse                        │
        │                                  │
        ▼                                  ▼
      Redis                            Spark
        │                                  │
        └──────────────┬───────────────────┘
                       │
                       ▼
                    Airflow
                       │
                       ▼
                      dbt
```

The endpoint provides a central operational view of the platform.

---

# 65. Dashboard

The frontend application is located at:

```text
services/frontend
```

Technology:

```text
React
TypeScript
Tailwind CSS
Recharts
Lucide
Vite
```

Development server:

```text
http://localhost:5173
```

---

# 66. Dashboard Pages

The dashboard currently provides:

```text
Overview
Revenue
Products
Customers
Realtime
Pipeline Health
```

### Overview

Provides high-level business and platform metrics.

### Revenue

Displays historical analytical revenue.

### Products

Displays product performance.

### Customers

Displays customer metrics and geographic information.

### Realtime

Displays low-latency streaming results.

### Pipeline Health

Displays operational health across the data platform.

---

# 67. Frontend API Communication

The frontend communicates with FastAPI through the Vite development proxy.

Frontend requests use:

```text
/api
```

The development proxy forwards these requests to:

```text
http://localhost:8000
```

This keeps the frontend API calls clean while allowing the backend to remain independently accessible.

---

# 68. Order Generator

FinPulse includes a simulated transactional workload generator.

Container:git commit -a -m "md files to be updated"

```text
finpulse-order-generator
```

It connects to:

```text
postgres-source:5432
```

Database:
git commit -a -m "md files to be updated"
```text
ecommerce
```

The configured event rate is:

```text
120 events per minute
```

The generator continuously creates orders and related transactional activity.

This provides a live data source for the CDC and streaming pipelines.

---

# 69. Order Lifecycle

Orders can move through the following statuses:

```textgit commit -a -m "md files to be updated"
placed
   │
   ▼
paid
   │
   ▼
shipped
```

Orders can also become:
git commit -a -m "md files to be updated"
```text
cancelled
```

The lifecycle creates realistic state changes that can be captured through CDC.

---

# 70. End-to-End Data Flow

A typical transaction moves through the platform as follows:

```text
1. Order generator
          │
          ▼
2. PostgreSQL OLTP
          │
          ├──────────────────────┐
          │                      │
          ▼                      ▼
3. Debezium                4. Airflow
          │                      │
          ▼                      ▼
5. Redpanda                6. Raw warehouse
          │                      │
          ▼                      ▼
7. Spark                   8. dbt
          │                      │
          ▼                      ▼
9. Redis                  10. Analytical marts
          │                      │
          └──────────┬───────────┘
                     │
                     ▼
               11. FastAPI
                     │
                     ▼
             12. React Dashboard
```

---

# 71. Full Lambda Flow

The complete Lambda architecture can be represented as:

```text
                       PostgreSQL OLTP
                              │
                 ┌────────────┴────────────┐
                 │                         │
                 ▼                         ▼
             Debezium                   Airflow
                 │                         │
                 ▼                         ▼
             Redpanda                 Raw Warehouse
                 │                         │
                 ▼                         ▼
              Spark                       dbt
                 │                         │
                 ▼                         ▼
              Redis                 Analytical Marts
                 │                         │
                 └────────────┬────────────┘
                              │
                              ▼
                           FastAPI
                              │
                              ▼
                         React UI
```

This provides:

```text
Speed Layer → recent low-latency information

Batch Layer → authoritative analytical information

Serving Layer → unified access to both
```

---

# 72. Docker Services

The Docker Compose environment contains thirteen service definitions:

| Service              | Responsibility                |
| -------------------- | ----------------------------- |
| `postgres-source`    | OLTP source database          |
| `postgres-warehouse` | Analytical warehouse          |
| `postgres-airflow`   | Airflow metadata database     |
| `airflow-init`       | Airflow initialization        |
| `airflow-scheduler`  | DAG scheduling and execution  |
| `airflow-webserver`  | Airflow UI and API            |
| `redpanda`           | Kafka-compatible event broker |
| `redpanda-console`   | Redpanda management UI        |
| `debezium`           | CDC connector runtime         |
| `redis`              | Realtime serving              |
| `spark-stream`       | Structured Streaming          |
| `api`                | FastAPI serving layer         |
| `order-generator`    | Simulated workload            |

`airflow-init` is an initialization job and normally exits successfully after completing its work.

---

# 73. Internal Docker Communication

Services communicate through Docker Compose service names.

Examples:

```text
postgres-source:5432
postgres-warehouse:5432
postgres-airflow:5432
redpanda:29092
redis:6379
debezium:8083
airflow-webserver:8080
```

This means containers do not need to use host `localhost` to communicate with one another.

---

# 74. Host Interfaces

The main host-facing interfaces are:

| Component            | Interface                    |
| -------------------- | ---------------------------- |
| React Dashboard      | `http://localhost:5173`      |
| FastAPI              | `http://localhost:8000`      |
| FastAPI Swagger      | `http://localhost:8000/docs` |
| Airflow              | `http://localhost:8080`      |
| Debezium             | `http://localhost:8083`      |
| Redpanda             | `localhost:9092`             |
| Redpanda Console     | `http://localhost:8085`      |
| Source PostgreSQL    | `localhost:5432`             |
| Warehouse PostgreSQL | `localhost:5433`             |
| Redis                | `localhost:6379`             |

---

# 75. Failure Isolation

The architecture intentionally separates the major components so individual failures do not necessarily stop the entire platform.

## Debezium failure

```text
Debezium fails
     │
     ▼
CDC stops
     │
     ├── PostgreSQL remains operational
     └── Batch pipeline remains independent
```

After Debezium is restored, CDC can reconnect and continue processing.

## Spark failure

```text
Spark fails
     │
     ▼
Realtime processing stops
     │
     ▼
Redis stops receiving new streaming results
```

Spark uses persistent checkpoint storage to support recovery.

## Airflow failure

```text
Airflow fails
     │
     ▼
Scheduled batch processing pauses
     │
     ├── Source remains operational
     └── CDC remains independent
```

## API failure

```text
FastAPI fails
     │
     ▼
Dashboard cannot retrieve data
     │
     ├── Batch pipeline continues
     └── Streaming pipeline continues
```

This separation demonstrates an important distributed-system principle: **the serving layer should not be tightly coupled to the data-processing layer.**

---

# 76. Data Quality Strategy

FinPulse applies data quality at multiple stages.

## Source layer

PostgreSQL enforces:

* primary keys
* unique constraints
* foreign keys
* not-null constraints
* quantity validation

## Staging layer

dbt validates:git commit -a -m "md files to be updated"

* identifiers
* required fields
* controlled statuses
* relationships

## Mart layer

dbt validates:

* analytical keys
* fact relationships
* dimensional uniqueness
* metric availability

## Monitoring layer

dbt exposes:

* row counts
* source timestamps
* source age

This creates a layered data quality strategy rather than relying on a single validation step.

---

# 77. Current Architecture Status

The core FinPulse platform is operational as a local development environment.

The implemented architecture includes:

* PostgreSQL source database
* PostgreSQL analytical warehouse
* PostgreSQL Airflow metadata database
* Debezium CDC
* Redpanda
* Redpanda Console
* Spark Structured Streaming
* Redis
* Airflow
* dbt
* FastAPI
* React frontend
* simulated order generator
* pipeline health monitoring

The platform demonstrates the complete path from transactional data to analytical and realtime serving.

---

# 78. Key Engineering Decisions

## PostgreSQL for both OLTP and warehouse

PostgreSQL provides a familiar SQL environment for both transactional and analytical workloads while keeping the project simple to run locally.

The databases remain physically separate.

## Debezium for CDC

Debezium demonstrates industry-standard log-based CDC instead of database polling.

## Redpanda instead of Kafka

Redpanda provides Kafka-compatible APIs while remaining lightweight for local development.

## Spark Structured Streaming

Spark demonstrates distributed stream processing and event-time windowing.

## Redis

Redis provides a simple and fast serving layer for recent streaming results.

## Airflow

Airflow provides explicit orchestration and scheduling for the batch pipeline.

## dbt

dbt makes analytical transformations modular, testable, and version controlled.

## FastAPI

FastAPI provides a lightweight serving layer between data infrastructure and the dashboard.

## React

React provides a practical interface for demonstrating both analytical and operational data.

---

# 79. Architectural Trade-offs

FinPulse is a portfolio-scale implementation rather than a production deployment.

Several deliberate trade-offs have therefore been made.

## Single-node Redpanda

The current Redpanda deployment uses a single broker.

Production systems would normally use multiple brokers and replication.

## Full batch extraction

The current Airflow pipeline extracts source tables into the raw layer rather than implementing fully incremental warehouse ingestion.

This keeps the project deterministic and easier to reproduce locally.

## Local infrastructure

All infrastructure runs through Docker Compose.

This makes the entire platform reproducible on a development machine.

## Simplified Lambda reconciliation

The Lambda endpoint exposes batch and speed-layer values together.

It does not implement a sophisticated production-grade exactly-once reconciliation mechanism.

## Development credentials

The current Docker environment uses development credentials.

Production environments should use:

* secrets management
* environment-specific configuration
* credential rotation
* least-privilege database users

---

# 80. Future Improvements

Potential production-oriented improvements include:

1. Incremental batch ingestion.
2. Incremental dbt models for very large datasets.
3. Kafka/Redpanda replication across multiple brokers.
4. Schema Registry and stronger event contracts.
5. CDC lag monitoring.
6. Consumer lag monitoring.
7. Automated alerting.
8. More comprehensive data quality tests.
9. CI/CD validation for dbt and Python.
10. Infrastructure-as-code.
11. Secrets management.
12. Historical dimension management.
13. More robust Lambda reconciliation.
14. Prometheus/Grafana observability.
15. Automated integration tests.
16. Data lineage tooling.
17. Production deployment to cloud infrastructure.

These improvements are intentionally outside the current local implementation scope.

---

# 81. Architecture Summary

FinPulse demonstrates a complete modern data engineering workflow:

                  TRANSACTIONAL SYSTEM
                          │
                          ▼
                    PostgreSQL OLTP
                          │
               ┌──────────┴──────────┐
               │                     │
               ▼                     ▼
            Debezium              Airflow
               │                     │
               ▼                     ▼
           Redpanda             Raw Warehouse
               │                     │
               ▼                     ▼
             Spark                  dbt
               │                     │
               ▼                     ▼
             Redis              Analytical Marts
               │                     │
               └──────────┬──────────┘
                          │
                          ▼
                       FastAPI
                          │
                          ▼
                    React Dashboard
```

The result is a locally reproducible data platform demonstrating:

* OLTP data modelling
* Change Data Capture
* event streaming
* stream processing
* event-time windowing
* realtime serving
* batch ELT
* analytical modelling
* dimensional modelling
* fact modelling
* data quality testing
* workflow orchestration
* operational monitoring
* API serving
* analytics visualisation

The architecture is intentionally modular so individual components can be replaced or upgraded without redesigning the entire platform.

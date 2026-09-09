# FinPulse Runbook

## 1. Purpose

This runbook explains how to run, check, and troubleshoot FinPulse locally.

It is intended for someone who is new to the project and wants to get the platform running without needing to understand the entire architecture first.

---

# 2. Prerequisites

Before running FinPulse, make sure you have:

* Docker
* Docker Compose
* Git
* A working internet connection for the initial image/package downloads

Check Docker:

```bash
docker --version
docker compose version
```

---

# 3. Start FinPulse

From the project root:

```bash
cd FinPulse
```

Start the platform:

```bash
make up
```

If the project does not have the Make target available, use:

```bash
docker compose up -d
```

Check the running containers:

```bash
docker compose ps
```

You should see the main FinPulse services running.

---

# 4. Main Services

The platform contains several services.

| Service              | Purpose                    |
| -------------------- | -------------------------- |
| PostgreSQL Source    | Stores e-commerce data     |
| Debezium             | Captures database changes  |
| Redpanda             | Streams change events      |
| Spark                | Processes real-time events |
| Redis                | Stores real-time results   |
| PostgreSQL Warehouse | Stores analytical data     |
| Airflow              | Runs batch pipelines       |
| dbt                  | Transforms warehouse data  |
| FastAPI              | Serves data through APIs   |
| React                | Provides the dashboard     |

---

# 5. Open the Dashboard

Once the services are running, open:

```text
http://localhost:5173
```

The dashboard provides access to areas such as:

* Overview
* Revenue
* Customers
* Products
* Product Details
* Realtime
* Pipeline Health

---

# 6. Useful Service Interfaces

| Service          | Address                      |
| ---------------- | ---------------------------- |
| React Dashboard  | `http://localhost:5173`      |
| FastAPI          | `http://localhost:8000`      |
| FastAPI Docs     | `http://localhost:8000/docs` |
| Airflow          | `http://localhost:8080`      |
| Redpanda Console | `http://localhost:8085`      |

These interfaces are useful when checking different parts of the platform.

---

# 7. Check the API

The simplest API health check is:

```bash
curl http://localhost:8000/health
```

A healthy API should return:

```json
{
  "status": "ok",
  "service": "finpulse-api"
}
```

You can also open the interactive API documentation:

```text
http://localhost:8000/docs
```

---

# 8. Check Docker Services

Run:

```bash
docker compose ps
```

Look for containers with a healthy or running status.

If a service is restarting or has stopped, inspect its logs.

For example:

```bash
docker compose logs --tail=100 <service-name>
```

To follow logs continuously:

```bash
docker compose logs -f <service-name>
```

Press:

```text
Ctrl + C
```

to stop following the logs.

---

# 9. Check the Batch Pipeline

FinPulse uses Airflow to manage the batch pipeline.

Open:

```text
http://localhost:8080
```

The main batch DAG is:

```text
finpulse_batch_etl
```

A successful run should show:

```text
success
```

The batch pipeline moves data through the warehouse and runs the dbt transformations.

---

# 10. Run the Batch Pipeline Manually

If you need to refresh the analytical data, trigger the batch DAG from Airflow.

The general flow is:

```text
PostgreSQL
    ↓
Warehouse
    ↓
dbt
    ↓
Marts
```

After the DAG completes successfully, the analytical data should be available to the API and dashboard.

---

# 11. Check the CDC Pipeline

FinPulse uses Debezium to capture changes from the source PostgreSQL database.

The flow is:

```text
PostgreSQL
    ↓
Debezium
    ↓
Redpanda
```

Check the Debezium logs:

```bash
docker compose logs --tail=100 debezium
```

Check Redpanda:

```bash
docker compose logs --tail=100 redpanda
```

The Redpanda Console can also be opened at:

```text
http://localhost:8085
```

This allows you to inspect topics and streaming activity.

---

# 12. Check Spark Streaming

Spark processes the events coming from Redpanda.

Check the Spark service:

```bash
docker compose ps
```

Then inspect its logs:

```bash
docker compose logs --tail=100 spark-stream
```

To follow the logs:

```bash
docker compose logs -f spark-stream
```

If Spark is restarting repeatedly, check the logs for configuration, connection, or dependency errors.

---

# 13. Check Redis

Redis stores real-time analytics produced by Spark.

Check Redis:

```bash
docker compose ps redis
```

You can inspect the Redis logs:

```bash
docker compose logs --tail=100 redis
```

The real-time application data includes keys such as:

```text
finpulse:realtime:revenue:latest
finpulse:realtime:revenue:series
finpulse:realtime:top_products
```

---

# 14. Test Batch API Endpoints

Useful endpoints include:

```text
GET /batch/daily-revenue
GET /batch/top-products
GET /batch/customers-summary
GET /batch/customer-metrics
GET /batch/customers-by-region
```

Example:

```bash
curl http://localhost:8000/batch/daily-revenue
```

Top products:

```bash
curl http://localhost:8000/batch/top-products
```

Customer metrics:

```bash
curl http://localhost:8000/batch/customer-metrics
```

---

# 15. Test Product Drill-Down

To retrieve a product:

```bash
curl http://localhost:8000/batch/products/1
```

To retrieve its sales history:

```bash
curl "http://localhost:8000/batch/products/1/sales-history"
```

To retrieve recent orders:

```bash
curl "http://localhost:8000/batch/products/1/orders"
```

Replace `1` with another product ID when needed.

---

# 16. Check the Frontend Build

The frontend is located in:

```text
services/frontend
```

Move into the directory:

```bash
cd services/frontend
```

Install dependencies if necessary:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

A successful production build should complete without errors.

---

# 17. Restart a Service

If one service needs to be restarted:

```bash
docker compose restart <service-name>
```

For example:

```bash
docker compose restart api
```

Then check its logs:

```bash
docker compose logs --tail=100 api
```

---

# 18. Rebuild a Service

If code or configuration has changed:

```bash
docker compose up -d --build <service-name>
```

For example:

```bash
docker compose up -d --build api
```

---

# 19. Restart the Entire Platform

To restart all services:

```bash
docker compose down
```

Then:

```bash
docker compose up -d
```

Check:

```bash
docker compose ps
```

---

# 20. Full Reset

Use a full reset only when necessary.

```bash
docker compose down -v
```

Then start again:

```bash
docker compose up -d
```

### Warning

The `-v` option removes Docker volumes.

This can remove locally stored database data.

Do not use it casually.

---

# 21. Common Problems

## API returns `500 Internal Server Error`

First check the API logs:

```bash
docker compose logs --tail=100 api
```

Then check whether the warehouse is running:

```bash
docker compose ps postgres-warehouse
```

If the warehouse is unavailable, the API may not be able to retrieve analytical data.

---

## Dashboard does not load

Check:

```bash
docker compose ps
```

Then make sure the frontend is running.

If running the frontend manually:

```bash
cd services/frontend
npm run dev
```

Also test the API:

```bash
curl http://localhost:8000/health
```

---

## Batch data looks outdated

Check Airflow:

```text
http://localhost:8080
```

Look at:

```text
finpulse_batch_etl
```

If the DAG failed, inspect the failed task's logs.

After fixing the problem, run the DAG again.

---

## Spark keeps restarting

Check:

```bash
docker compose logs --tail=200 spark-stream
```

Look for errors related to:

* Redpanda connectivity
* Redis connectivity
* Spark configuration
* Python dependencies
* Kafka/Redpanda topics

---

## Debezium is not producing events

Check:

```bash
docker compose logs --tail=200 debezium
```

Then check Redpanda Console:

```text
http://localhost:8085
```

Confirm that the expected topics exist and are receiving events.

---

## A container is not running

Run:

```bash
docker compose ps
```

Then inspect the affected service:

```bash
docker compose logs --tail=200 <service-name>
```

If necessary:

```bash
docker compose restart <service-name>
```

---

# 22. Recommended Troubleshooting Order

When something goes wrong, do not immediately restart everything.

Follow the data flow.

```text
1. Is Docker running?
        ↓
2. Is the affected container running?
        ↓
3. Check its logs
        ↓
4. Check its dependency
        ↓
5. Fix the problem
        ↓
6. Restart only the affected service
        ↓
7. Test again
```

For example, if real-time analytics are not updating:

```text
PostgreSQL
    ↓
Check Debezium
    ↓
Check Redpanda
    ↓
Check Spark
    ↓
Check Redis
    ↓
Check FastAPI
    ↓
Check Dashboard
```

This makes troubleshooting much easier.

---

# 23. Stopping FinPulse

To stop the platform:

```bash
docker compose down
```

This stops and removes the containers but does not normally remove the persistent Docker volumes.

Start it again with:

```bash
docker compose up -d
```

---

# 24. Quick Health Checklist

Before considering FinPulse operational, check:

```text
[ ] Docker is running
[ ] PostgreSQL source is running
[ ] PostgreSQL warehouse is running
[ ] Debezium is running
[ ] Redpanda is running
[ ] Spark is running
[ ] Redis is running
[ ] Airflow is running
[ ] Batch DAG succeeds
[ ] FastAPI health check succeeds
[ ] Frontend loads
[ ] Dashboard displays data
```

---

# 25. Useful Commands

### See all containers

```bash
docker compose ps
```

### View all logs

```bash
docker compose logs --tail=100
```

### Follow all logs

```bash
docker compose logs -f
```

### Restart everything

```bash
docker compose restart
```

### Stop everything

```bash
docker compose down
```

### Start everything

```bash
docker compose up -d
```

### Rebuild everything

```bash
docker compose up -d --build
```

---

# 26. Simple Operational Flow

The easiest way to remember how to operate FinPulse is:

```text
START
  ↓
docker compose up -d
  ↓
docker compose ps
  ↓
Check API
  ↓
Check Airflow
  ↓
Check streaming services
  ↓
Open Dashboard
  ↓
Verify data
```

If something fails:

```text
Find the failing component
        ↓
Read its logs
        ↓
Check its dependency
        ↓
Fix
        ↓
Restart
        ↓
Verify
```

---

## 27. Final Note

FinPulse contains several interconnected services, so troubleshooting is easiest when you follow the **data flow** rather than treating the platform as one large application.

The most important principle is:

> **Find where the data stopped moving.**

Once the failing component is identified, its logs and dependencies usually provide the information needed to resolve the problem.

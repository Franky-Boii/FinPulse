# FinPulse Operations Runbook

## 1. Purpose

This runbook describes how to operate the FinPulse data platform locally.

It covers:

- Starting the platform
- Stopping the platform
- Checking service health
- Registering the Debezium connector
- Verifying CDC
- Verifying Spark Structured Streaming
- Running the batch pipeline
- Running dbt manually
- Checking Redis
- Checking the FastAPI API
- Checking the dashboard
- Troubleshooting common failures
- Resetting the platform

---

# 2. Prerequisites

FinPulse requires:

- Docker
- Docker Compose
- Git
- A Linux/macOS environment capable of running Docker

Verify Docker:

```bash
docker --version
docker compose version
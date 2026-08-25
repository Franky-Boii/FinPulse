from fastapi import FastAPI

from .routers import batch, realtime, lambda_view

app = FastAPI(
    title="FinPulse API",
    description=(
        "Serving layer for the FinPulse Lambda-architecture data platform. "
        "Exposes the batch layer (dbt marts, hourly-refreshed and authoritative), "
        "the speed layer (Spark Structured Streaming via Redis, sub-minute latency), "
        "and a merged view that combines both."
    ),
    version="1.0.0",
)

app.include_router(batch.router)
app.include_router(realtime.router)
app.include_router(lambda_view.router)


@app.get("/health")
def health():
    return {"status": "ok"}

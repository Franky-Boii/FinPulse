from fastapi import FastAPI

from .routers import batch
from .routers import products
from .routers import realtime
from .routers import lambda_view
from .routers import pipeline


app = FastAPI(
    title="FinPulse API",
    description=(
        "Serving layer for the FinPulse "
        "Lambda-architecture data platform."
    ),
    version="1.0.0",
)


app.include_router(batch.router)

app.include_router(products.router)

app.include_router(realtime.router)

app.include_router(lambda_view.router)

app.include_router(pipeline.router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "finpulse-api",
    }

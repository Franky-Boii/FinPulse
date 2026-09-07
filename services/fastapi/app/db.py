import os

import redis
from sqlalchemy import create_engine

WAREHOUSE_DB_URI = os.environ.get(
    "WAREHOUSE_DB_URI",
    "postgresql://finpulse:finpulse@postgres-warehouse:5432/warehouse",
)

SOURCE_DB_URI = os.environ.get(
    "SOURCE_DB_URI",
    "postgresql://finpulse:finpulse@postgres-source:5432/ecommerce",
)

REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))

warehouse_engine = create_engine(
    WAREHOUSE_DB_URI,
    pool_pre_ping=True,
)

source_engine = create_engine(
    SOURCE_DB_URI,
    pool_pre_ping=True,
)

# Backward-compatible alias.
# Existing batch/lambda routers use `engine` for the warehouse.
engine = warehouse_engine

redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    decode_responses=True,
)

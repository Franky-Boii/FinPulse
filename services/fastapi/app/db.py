import os

import redis
from sqlalchemy import create_engine

WAREHOUSE_DB_URI = os.environ.get(
    "WAREHOUSE_DB_URI", "postgresql://finpulse:finpulse@postgres-warehouse:5432/warehouse"
)
REDIS_HOST = os.environ.get("REDIS_HOST", "redis")

engine = create_engine(WAREHOUSE_DB_URI, pool_pre_ping=True)
redis_client = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)

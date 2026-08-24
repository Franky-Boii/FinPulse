"""
FinPulse — one-off bootstrap DAG.

Registers the Debezium Postgres source connector with Kafka Connect.
Not scheduled — trigger manually after `docker compose up` the first
time (or any time you want to confirm/repair the connector's config;
the PUT is idempotent).
"""

from __future__ import annotations

import json
import pendulum
import requests

from airflow.decorators import dag, task

CONNECT_URL = "http://debezium:8083"

CONNECTOR_CONFIG = {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres-source",
    "database.port": "5432",
    "database.user": "finpulse",
    "database.password": "finpulse",
    "database.dbname": "ecommerce",
    "topic.prefix": "finpulse",
    "plugin.name": "pgoutput",
    "publication.name": "finpulse_publication",
    "slot.name": "finpulse_slot",
    "table.include.list": "public.customers,public.products,public.orders,public.order_items,public.payments",
    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "key.converter.schemas.enable": "false",
    "value.converter.schemas.enable": "false",
    "tombstones.on.delete": "false",
    "decimal.handling.mode": "double",
    "snapshot.mode": "initial",
}


@dag(
    dag_id="finpulse_bootstrap_cdc",
    description="Registers the Debezium source connector (idempotent, manual trigger)",
    schedule=None,
    start_date=pendulum.datetime(2026, 1, 1, tz="UTC"),
    catchup=False,
    tags=["finpulse", "bootstrap", "cdc"],
)
def finpulse_bootstrap_cdc():

    @task
    def register_connector():
        resp = requests.put(
            f"{CONNECT_URL}/connectors/finpulse-source-connector/config",
            headers={"Content-Type": "application/json"},
            data=json.dumps(CONNECTOR_CONFIG),
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()

    register_connector()


finpulse_bootstrap_cdc()

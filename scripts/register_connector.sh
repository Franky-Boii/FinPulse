#!/usr/bin/env bash
# Registers (or updates) the Debezium Postgres source connector with the
# Kafka Connect REST API. Idempotent — safe to re-run.
set -euo pipefail

CONNECT_URL="${CONNECT_URL:-http://localhost:8083}"
CONFIG_FILE="$(dirname "$0")/../streaming/debezium/connector-source.json"

echo "Waiting for Kafka Connect at ${CONNECT_URL} ..."
until curl -s -o /dev/null -w "%{http_code}" "${CONNECT_URL}/connectors" | grep -qE "200|401"; do
  sleep 3
done

echo "Registering finpulse-source-connector ..."
curl -s -X PUT \
  -H "Content-Type: application/json" \
  --data "$(python3 -c "import json,sys; print(json.dumps(json.load(open('${CONFIG_FILE}'))['config']))")" \
  "${CONNECT_URL}/connectors/finpulse-source-connector/config" | python3 -m json.tool

echo
echo "Connector status:"
curl -s "${CONNECT_URL}/connectors/finpulse-source-connector/status" | python3 -m json.tool

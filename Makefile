.PHONY: up down restart logs ps register-connector dbt-run dbt-test seed-check clean

up: ## Build and start every service in the background
	docker compose up -d --build

down: ## Stop and remove all containers (keeps volumes/data)
	docker compose down

restart: down up

logs: ## Tail logs for all services (Ctrl+C to stop)
	docker compose logs -f

ps: ## Show status of all services
	docker compose ps

register-connector: ## Register the Debezium CDC connector (run once, after `make up`)
	bash scripts/register_connector.sh

dbt-run: ## Manually trigger a dbt run inside the airflow-scheduler container
	docker compose exec airflow-scheduler bash -c "cd /opt/dbt/finpulse && dbt run --profiles-dir /opt/dbt"

dbt-test: ## Manually trigger dbt tests inside the airflow-scheduler container
	docker compose exec airflow-scheduler bash -c "cd /opt/dbt/finpulse && dbt test --profiles-dir /opt/dbt"

seed-check: ## Peek at row counts in the source DB to confirm traffic is flowing
	docker compose exec postgres-source psql -U finpulse -d ecommerce -c \
		"select 'customers', count(*) from customers union all select 'orders', count(*) from orders union all select 'order_items', count(*) from order_items union all select 'payments', count(*) from payments;"

clean: ## Stop everything AND delete all volumes (full reset)
	docker compose down -v

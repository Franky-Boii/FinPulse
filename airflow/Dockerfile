FROM apache/airflow:2.9.3-python3.11

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER airflow

RUN pip install --no-cache-dir \
    "dbt-core==1.8.7" \
    "dbt-postgres==1.8.2" \
    "pandas==2.2.2" \
    "psycopg2-binary==2.9.9" \
    "sqlalchemy==1.4.51"

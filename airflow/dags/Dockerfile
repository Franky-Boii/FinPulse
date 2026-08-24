FROM apache/airflow:2.9.3-python3.11

USER airflow
RUN pip install --no-cache-dir \
    dbt-postgres==1.8.2 \
    pandas==2.2.2 \
    sqlalchemy==2.0.31 \
    psycopg2-binary==2.9.9

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir pyspark==3.5.2

COPY spark_jobs/ ./spark_jobs/

CMD ["python", "spark_jobs/stream_processor.py"]

"""
FinPulse order generator.

Simulates a live e-commerce application writing to the OLTP source
database: new customers signing up, new orders being placed, and
existing orders/payments transitioning through their lifecycle
(placed -> paid -> shipped, or -> cancelled).

This is what gives the pipeline something to actually process — the
INSERTs and UPDATEs here are exactly what Debezium picks up off the
Postgres write-ahead log and streams into Redpanda.
"""

import os
import random
import time
import logging

import psycopg2
from faker import Faker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [generator] %(message)s")
log = logging.getLogger(__name__)

fake = Faker()

DB_URI = os.environ.get("DB_URI", "postgresql://finpulse:finpulse@localhost:5432/ecommerce")
EVENTS_PER_MINUTE = int(os.environ.get("EVENTS_PER_MINUTE", "60"))
SLEEP_SECONDS = max(60.0 / max(EVENTS_PER_MINUTE, 1), 0.25)

PAYMENT_METHODS = ["card", "eft", "wallet"]
COUNTRIES = ["South Africa", "Nigeria", "Kenya", "Ireland", "Singapore", "United Kingdom", "Germany"]


def connect():
    for attempt in range(30):
        try:
            conn = psycopg2.connect(DB_URI)
            conn.autocommit = True
            return conn
        except psycopg2.OperationalError as e:
            log.warning("DB not ready yet (attempt %s): %s", attempt + 1, e)
            time.sleep(2)
    raise RuntimeError("Could not connect to source database after retries")


def maybe_create_customer(cur):
    if random.random() < 0.05:  # ~5% of ticks bring a new customer
        cur.execute(
            """
            INSERT INTO customers (full_name, email, country, signup_date)
            VALUES (%s, %s, %s, CURRENT_DATE)
            ON CONFLICT (email) DO NOTHING
            """,
            (fake.name(), fake.unique.email(), random.choice(COUNTRIES)),
        )
        log.info("New customer signed up")


def random_customer_id(cur):
    cur.execute("SELECT customer_id FROM customers ORDER BY random() LIMIT 1")
    row = cur.fetchone()
    return row[0] if row else None


def random_products(cur, n=None):
    n = n or random.randint(1, 3)
    cur.execute("SELECT product_id, unit_price FROM products ORDER BY random() LIMIT %s", (n,))
    return cur.fetchall()


def place_order(cur):
    customer_id = random_customer_id(cur)
    if customer_id is None:
        return None

    cur.execute(
        "INSERT INTO orders (customer_id, order_status) VALUES (%s, 'placed') RETURNING order_id",
        (customer_id,),
    )
    order_id = cur.fetchone()[0]

    total = 0.0
    for product_id, unit_price in random_products(cur):
        qty = random.randint(1, 4)
        cur.execute(
            """
            INSERT INTO order_items (order_id, product_id, quantity, unit_price)
            VALUES (%s, %s, %s, %s)
            """,
            (order_id, product_id, qty, unit_price),
        )
        total += float(unit_price) * qty

    cur.execute(
        """
        INSERT INTO payments (order_id, amount, payment_method, payment_status)
        VALUES (%s, %s, %s, 'pending')
        """,
        (order_id, round(total, 2), random.choice(PAYMENT_METHODS)),
    )
    log.info("Order #%s placed for customer #%s (R%.2f)", order_id, customer_id, total)
    return order_id


def advance_random_order(cur):
    """Push a random in-flight order forward through its lifecycle —
    this is what produces UPDATE events on the CDC stream."""
    cur.execute(
        """
        SELECT order_id, order_status FROM orders
        WHERE order_status IN ('placed', 'paid')
        ORDER BY random() LIMIT 1
        """
    )
    row = cur.fetchone()
    if not row:
        return
    order_id, status = row

    if status == "placed":
        if random.random() < 0.85:
            cur.execute(
                "UPDATE orders SET order_status = 'paid', updated_at = now() WHERE order_id = %s",
                (order_id,),
            )
            cur.execute(
                """
                UPDATE payments SET payment_status = 'success', paid_at = now()
                WHERE order_id = %s
                """,
                (order_id,),
            )
            log.info("Order #%s marked paid", order_id)
        else:
            cur.execute(
                "UPDATE orders SET order_status = 'cancelled', updated_at = now() WHERE order_id = %s",
                (order_id,),
            )
            cur.execute(
                "UPDATE payments SET payment_status = 'failed' WHERE order_id = %s",
                (order_id,),
            )
            log.info("Order #%s cancelled", order_id)
    elif status == "paid":
        cur.execute(
            "UPDATE orders SET order_status = 'shipped', updated_at = now() WHERE order_id = %s",
            (order_id,),
        )
        log.info("Order #%s shipped", order_id)


def main():
    log.info("Starting order generator — ~%s events/min against %s", EVENTS_PER_MINUTE, DB_URI.split("@")[-1])
    conn = connect()
    with conn.cursor() as cur:
        while True:
            try:
                maybe_create_customer(cur)
                if random.random() < 0.6:
                    place_order(cur)
                else:
                    advance_random_order(cur)
            except Exception:
                log.exception("Tick failed, continuing")
            time.sleep(SLEEP_SECONDS)


if __name__ == "__main__":
    main()

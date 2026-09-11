"""
Unit tests for the customer summary aggregation logic in
app/routers/batch.py.

summarize_customers() derives averages from raw totals and guards against
division by zero when there are no customers yet. It does not touch
Postgres, so these tests run without any services running.
"""

from app.routers.batch import summarize_customers


class TestSummarizeCustomers:
    def test_computes_average_spend_and_orders_per_customer(self):
        result = summarize_customers(
            customer_count=10,
            total_orders=50,
            total_revenue=10000.0,
            total_units=200,
        )

        assert result["average_customer_spend"] == 1000.0
        assert result["average_orders_per_customer"] == 5.0

    def test_passes_through_the_raw_totals_unchanged(self):
        result = summarize_customers(
            customer_count=10,
            total_orders=50,
            total_revenue=10000.0,
            total_units=200,
        )

        assert result["customer_count"] == 10
        assert result["total_orders"] == 50
        assert result["total_revenue"] == 10000.0
        assert result["total_units"] == 200

    def test_zero_customers_does_not_raise_a_division_error(self):
        result = summarize_customers(
            customer_count=0,
            total_orders=0,
            total_revenue=0.0,
            total_units=0,
        )

        assert result["average_customer_spend"] == 0
        assert result["average_orders_per_customer"] == 0

    def test_zero_customers_with_nonzero_revenue_still_guards_division(self):
        # Defensive case: shouldn't happen in practice (revenue implies a
        # customer), but the guard should hold regardless of the data.
        result = summarize_customers(
            customer_count=0,
            total_orders=0,
            total_revenue=500.0,
            total_units=0,
        )

        assert result["average_customer_spend"] == 0
        assert result["average_orders_per_customer"] == 0

    def test_single_customer_average_equals_their_own_totals(self):
        result = summarize_customers(
            customer_count=1,
            total_orders=7,
            total_revenue=999.0,
            total_units=14,
        )

        assert result["average_customer_spend"] == 999.0
        assert result["average_orders_per_customer"] == 7.0
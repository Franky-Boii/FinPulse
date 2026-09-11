"""
Unit tests for the Lambda architecture merge logic in
app/routers/lambda_view.py.

merge_layers() is the pure arithmetic step that combines the batch layer's
authoritative totals with the speed layer's latest window. It does not
touch Postgres or Redis, so these tests run without any services running.
"""

from app.routers.lambda_view import merge_layers


class TestMergeLayers:
    def test_adds_orders_from_both_layers(self):
        result = merge_layers(
            batch_orders=100,
            batch_revenue=5000.0,
            speed_orders=3,
            speed_revenue=150.0,
        )

        assert result["order_count"] == 103

    def test_adds_revenue_from_both_layers(self):
        result = merge_layers(
            batch_orders=100,
            batch_revenue=5000.0,
            speed_orders=3,
            speed_revenue=150.0,
        )

        assert result["revenue"] == 5150.0

    def test_handles_no_speed_layer_data_yet(self):
        # e.g. the streaming pipeline hasn't produced a window yet today
        result = merge_layers(
            batch_orders=250,
            batch_revenue=12345.67,
            speed_orders=0,
            speed_revenue=0.0,
        )

        assert result == {"order_count": 250, "revenue": 12345.67}

    def test_handles_an_empty_batch_day(self):
        # e.g. very first minute of a new day, before any batch run
        result = merge_layers(
            batch_orders=0,
            batch_revenue=0.0,
            speed_orders=5,
            speed_revenue=299.99,
        )

        assert result == {"order_count": 5, "revenue": 299.99}

    def test_rounds_revenue_to_two_decimal_places(self):
        result = merge_layers(
            batch_orders=1,
            batch_revenue=10.111,
            speed_orders=1,
            speed_revenue=0.005,
        )

        assert result["revenue"] == round(10.111 + 0.005, 2)

    def test_zero_everything_returns_zero(self):
        result = merge_layers(0, 0.0, 0, 0.0)

        assert result == {"order_count": 0, "revenue": 0.0}
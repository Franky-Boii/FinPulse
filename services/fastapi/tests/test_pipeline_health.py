"""
Unit tests for the pipeline health aggregation logic in
app/routers/pipeline.py.

These only exercise pure functions (healthy/degraded/unhealthy builders
and summarize_checks). They do not touch Postgres, Redis, Airflow,
Debezium, or Redpanda, so they run anywhere without any services running.
"""

from app.routers.pipeline import (
    degraded,
    healthy,
    summarize_checks,
    unhealthy,
)


class TestStatusBuilders:
    def test_healthy_has_expected_shape(self):
        result = healthy("Redis", "Redis is responding to PING.")

        assert result == {
            "name": "Redis",
            "status": "healthy",
            "message": "Redis is responding to PING.",
            "latency_ms": None,
            "details": {},
        }

    def test_degraded_carries_latency_and_details(self):
        result = degraded(
            "Airflow",
            "Airflow is reachable but not fully healthy.",
            latency_ms=42.5,
            details={"scheduler": "unhealthy"},
        )

        assert result["status"] == "degraded"
        assert result["latency_ms"] == 42.5
        assert result["details"] == {"scheduler": "unhealthy"}

    def test_unhealthy_defaults_details_to_empty_dict(self):
        result = unhealthy("Redpanda", "Unable to reach the Admin API.")

        assert result["status"] == "unhealthy"
        assert result["details"] == {}


class TestSummarizeChecks:
    def test_all_healthy_checks_yield_healthy_overall_status(self):
        checks = [
            healthy("FastAPI", "ok"),
            healthy("Redis", "ok"),
            healthy("PostgreSQL Warehouse", "ok"),
        ]

        result = summarize_checks(checks)

        assert result["status"] == "healthy"
        assert result["summary"] == {
            "total": 3,
            "healthy": 3,
            "degraded": 0,
            "unhealthy": 0,
        }

    def test_a_single_degraded_check_degrades_the_overall_status(self):
        checks = [
            healthy("FastAPI", "ok"),
            degraded("Airflow", "scheduler unhealthy"),
            healthy("Redis", "ok"),
        ]

        result = summarize_checks(checks)

        assert result["status"] == "degraded"
        assert result["summary"]["degraded"] == 1

    def test_any_unhealthy_check_makes_the_whole_platform_unhealthy(self):
        # Even with many healthy checks and one degraded, a single
        # unhealthy check should dominate the overall status.
        checks = [
            healthy("FastAPI", "ok"),
            healthy("Redis", "ok"),
            degraded("Airflow", "scheduler unhealthy"),
            unhealthy("PostgreSQL Warehouse", "connection refused"),
        ]

        result = summarize_checks(checks)

        assert result["status"] == "unhealthy"
        assert result["summary"] == {
            "total": 4,
            "healthy": 2,
            "degraded": 1,
            "unhealthy": 1,
        }

    def test_empty_check_list_is_treated_as_healthy(self):
        result = summarize_checks([])

        assert result["status"] == "healthy"
        assert result["summary"] == {
            "total": 0,
            "healthy": 0,
            "degraded": 0,
            "unhealthy": 0,
        }

    def test_counts_match_the_number_of_checks_of_each_status(self):
        checks = [
            healthy("A", "ok"),
            healthy("B", "ok"),
            degraded("C", "meh"),
            degraded("D", "meh"),
            degraded("E", "meh"),
            unhealthy("F", "down"),
        ]

        result = summarize_checks(checks)

        assert result["summary"]["total"] == 6
        assert result["summary"]["healthy"] == 2
        assert result["summary"]["degraded"] == 3
        assert result["summary"]["unhealthy"] == 1
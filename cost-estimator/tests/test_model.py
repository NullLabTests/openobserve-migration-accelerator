"""Behavioural tests for the cost model and CLI.

These assert observable outputs (numbers, JSON shape, exit codes), not
implementation details.
"""

import json
import os
import subprocess
import sys

import pytest

# Make the package importable when tests run from the repo without install.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from openobserve_cost import model  # noqa: E402
from openobserve_cost.cli import main  # noqa: E402


def approx(a, b, tol=1e-6):
    return abs(a - b) <= tol


# --------------------------------------------------------------------------
# Model math
# --------------------------------------------------------------------------
def test_storage_math_is_correct():
    inp = model.CostInputs(
        daily_ingest_gb=100,
        retention_days=30,
        compression_ratio=0.10,
        storage_usd_per_gb_month=0.023,
        compute_nodes=1,
        compute_usd_per_node_month=60.0,
    )
    est = model.estimate(inp)

    assert approx(est.monthly_raw_gb, 3000)
    assert approx(est.retained_raw_gb, 3000)
    assert approx(est.retained_stored_gb, 300)
    assert approx(est.storage_cost_monthly, 300 * 0.023)
    assert approx(est.compute_cost_monthly, 60.0)
    assert approx(est.openobserve_monthly, 300 * 0.023 + 60.0)
    assert approx(est.openobserve_annual, (300 * 0.023 + 60.0) * 12)


def test_retention_changes_storage_only():
    base = model.CostInputs(daily_ingest_gb=100, retention_days=30)
    longer = model.CostInputs(daily_ingest_gb=100, retention_days=60)
    e1, e2 = model.estimate(base), model.estimate(longer)
    # Doubling retention doubles stored + storage cost, not compute.
    assert approx(e2.retained_stored_gb, e1.retained_stored_gb * 2)
    assert approx(e2.storage_cost_monthly, e1.storage_cost_monthly * 2)
    assert approx(e2.compute_cost_monthly, e1.compute_cost_monthly)


def test_current_spend_takes_precedence_over_source():
    inp = model.CostInputs(
        daily_ingest_gb=100,
        current_spend_monthly=12345.0,
        source="datadog",
    )
    est = model.estimate(inp)
    assert approx(est.current_monthly, 12345.0)
    assert est.monthly_savings is not None
    assert est.current_source == "datadog"


def test_source_fallback_rate_used_when_no_spend():
    inp = model.CostInputs(daily_ingest_gb=10, source="splunk")
    est = model.estimate(inp)
    expected = 10 * model.PRICEBOOK["providers"]["splunk"] * 30
    assert approx(est.current_monthly, expected)
    assert est.reduction_factor is not None


def test_source_rate_override():
    inp = model.CostInputs(daily_ingest_gb=10, source="datadog", source_usd_per_gb_day=9.0)
    est = model.estimate(inp)
    assert approx(est.current_monthly, 10 * 9.0 * 30)


def test_savings_math_and_percent():
    inp = model.CostInputs(
        daily_ingest_gb=100,
        retention_days=30,
        compression_ratio=0.10,
        storage_usd_per_gb_month=0.023,
        compute_nodes=1,
        compute_usd_per_node_month=60.0,
        current_spend_monthly=10000.0,
    )
    est = model.estimate(inp)
    assert approx(est.monthly_savings, 10000.0 - est.openobserve_monthly)
    assert approx(est.annual_savings, est.monthly_savings * 12)
    assert approx(est.savings_pct, (est.monthly_savings / 10000.0) * 100)


def test_no_source_means_no_savings():
    est = model.estimate(model.CostInputs(daily_ingest_gb=5))
    assert est.current_monthly is None
    assert est.monthly_savings is None


def test_validation_rejects_bad_input():
    with pytest.raises(ValueError):
        model.estimate(model.CostInputs(daily_ingest_gb=-1))
    with pytest.raises(ValueError):
        model.estimate(model.CostInputs(daily_ingest_gb=1, compression_ratio=0))
    with pytest.raises(ValueError):
        model.estimate(model.CostInputs(daily_ingest_gb=1, compression_ratio=1.5))


# --------------------------------------------------------------------------
# Formatters
# --------------------------------------------------------------------------
def test_json_output_is_valid_and_complete():
    est = model.estimate(model.CostInputs(daily_ingest_gb=100, source="datadog"))
    payload = json.loads(model.format_json(est))
    for key in (
        "openobserve_monthly",
        "storage_cost_monthly",
        "compute_cost_monthly",
        "current_monthly",
        "monthly_savings",
        "assumptions",
    ):
        assert key in payload
    assert payload["assumptions"]["days_per_month"] == 30


def test_markdown_contains_totals():
    est = model.estimate(model.CostInputs(daily_ingest_gb=100, source="datadog"))
    md = model.format_markdown(est)
    assert "# OpenObserve Cost Estimate" in md
    assert "Total" in md


# --------------------------------------------------------------------------
# CLI end-to-end (in-process)
# --------------------------------------------------------------------------
def test_cli_text_runs_and_reports_totals(capsys):
    rc = main(["--daily-gb", "100", "--source", "datadog"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "TOTAL / month" in out
    assert "TOTAL / year" in out


def test_cli_json_mode(capsys):
    rc = main(["--daily-gb", "100", "--source", "datadog", "--json"])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["daily_ingest_gb"] == 100


def test_cli_show_assumptions(capsys):
    rc = main(["--show-assumptions"])
    assert rc == 0
    assert "compression_ratio" in capsys.readouterr().out


def test_cli_missing_daily_gb_exits_with_error():
    # argparse.error() raises SystemExit(2).
    with pytest.raises(SystemExit) as exc:
        main([])
    assert exc.value.code == 2


def test_cli_runs_as_module():
    """The CLI must work via `python -m openobserve_cost` too."""
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "openobserve_cost",
            "--daily-gb",
            "10",
            "--source",
            "datadog",
            "--json",
        ],
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    payload = json.loads(result.stdout)
    assert payload["daily_ingest_gb"] == 10

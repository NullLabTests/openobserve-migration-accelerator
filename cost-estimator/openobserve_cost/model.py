"""Core, dependency-free cost model.

Everything here is plain Python so it can be imported by tests and reused. No
network access, no third-party packages.

MODEL SUMMARY
-------------
OpenObserve stores data as Parquet files on object storage (S3 / GCS / Azure
Blob) and compresses with an adaptive zstd-based scheme. That gives a large
compression ratio for typical log/telemetry payloads (10x is a conservative
default; JSON logs frequently hit 15-20x). Because storage is on cheap object
storage rather than a hot search index, the per-GB cost is a small fraction of
a Datadog/Splunk/Elastic ingest bill.

Estimated OpenObserve monthly cost:

    retained_raw_gb      = daily_ingest_gb * retention_days
    retained_stored_gb   = retained_raw_gb * compression_ratio
    storage_cost         = retained_stored_gb * storage_usd_per_gb_month
    compute_cost         = compute_nodes * compute_usd_per_node_month
    openobserve_monthly  = storage_cost + compute_cost

Current provider spend is taken directly from ``--current-spend`` when the user
knows it. Otherwise it is *roughly* inferred from a documented per-GB/day rate
(see PRICEBOOK) which the user can override. All figures are ballparks meant to
frame a POC conversation, not invoices.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, asdict, field
from typing import Optional


# ---------------------------------------------------------------------------
# Pricebook: documented, overridable ballpark assumptions.
# Consumers should treat these as starting points and replace them with their
# own negotiated/current pricing before making decisions.
# ---------------------------------------------------------------------------
PRICEBOOK = {
    # OpenObserve side -----------------------------------------------------
    "openobserve": {
        # Adaptive zstd/Parquet compression. 10x (ratio 0.10) is conservative
        # for structured logs; 15-20x is common. Lower ratio == less savings.
        "compression_ratio": 0.10,
        # Object storage list price, USD/GB/month. S3 Standard = 0.023,
        # S3 IA = 0.0125, GCS Standard = 0.020. On-prem/Ceph is cheaper.
        "storage_usd_per_gb_month": 0.023,
        # One modest OpenObserve node handles very high ingest; bump for HA.
        "compute_nodes": 1,
        "compute_usd_per_node_month": 60.0,
    },
    # Current-provider fallback rates (USD per GB/day of daily ingest per
    # month) used ONLY when --current-spend is not supplied. Keep these
    # deliberately conservative and clearly documented.
    "providers": {
        # Datadog log ingest list price is $0.10/GB; indexing/retention adds
        # significantly on top. 3.00 = 0.10 * 30 days (ingest-only floor).
        "datadog": 3.00,
        # Splunk ingest list price is ~$150/GB/day (annual) => 150/12 = 12.50
        # per GB/day per month. Real contracts are heavily discounted.
        "splunk": 12.50,
        # Elastic Cloud hot-tier blended estimate, ~$0.05/GB/day * 30.
        "elastic": 1.50,
    },
    "days_per_month": 30,
}


@dataclass
class CostInputs:
    """Inputs to the estimator. All monetary values are USD."""

    daily_ingest_gb: float
    retention_days: int = 30
    compression_ratio: float = PRICEBOOK["openobserve"]["compression_ratio"]
    storage_usd_per_gb_month: float = PRICEBOOK["openobserve"]["storage_usd_per_gb_month"]
    compute_nodes: int = PRICEBOOK["openobserve"]["compute_nodes"]
    compute_usd_per_node_month: float = PRICEBOOK["openobserve"]["compute_usd_per_node_month"]
    # Optional comparison data.
    current_spend_monthly: Optional[float] = None
    source: Optional[str] = None  # one of: datadog, splunk, elastic
    source_usd_per_gb_day: Optional[float] = None

    def validate(self) -> None:
        if self.daily_ingest_gb < 0:
            raise ValueError("daily_ingest_gb must be >= 0")
        if self.retention_days < 0:
            raise ValueError("retention_days must be >= 0")
        if not 0 < self.compression_ratio <= 1:
            raise ValueError("compression_ratio must be in (0, 1]")
        if self.storage_usd_per_gb_month < 0:
            raise ValueError("storage_usd_per_gb_month must be >= 0")
        if self.compute_nodes < 0 or self.compute_usd_per_node_month < 0:
            raise ValueError("compute values must be >= 0")
        if self.current_spend_monthly is not None and self.current_spend_monthly < 0:
            raise ValueError("current_spend_monthly must be >= 0")
        if self.source and self.source.lower() not in PRICEBOOK["providers"]:
            raise ValueError(
                "source must be one of: " + ", ".join(sorted(PRICEBOOK["providers"]))
            )


@dataclass
class CostEstimate:
    """Computed estimate. All monetary values are USD unless noted."""

    # volume
    daily_ingest_gb: float
    retention_days: int
    monthly_raw_gb: float
    retained_raw_gb: float
    retained_stored_gb: float
    compression_ratio: float
    # openobserve cost
    storage_cost_monthly: float
    compute_cost_monthly: float
    openobserve_monthly: float
    openobserve_annual: float
    # comparison
    current_source: str
    current_monthly: Optional[float]
    monthly_savings: Optional[float]
    annual_savings: Optional[float]
    savings_pct: Optional[float]
    reduction_factor: Optional[float]
    assumptions: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def _resolve_current_monthly(inp: CostInputs) -> tuple[str, Optional[float]]:
    """Return (source_label, monthly_cost_or_None)."""
    if inp.current_spend_monthly is not None:
        label = inp.source.lower() if inp.source else "custom"
        return label, float(inp.current_spend_monthly)

    if inp.source:
        source = inp.source.lower()
        rate = inp.source_usd_per_gb_day
        if rate is None:
            rate = PRICEBOOK["providers"][source]
        monthly = inp.daily_ingest_gb * rate * PRICEBOOK["days_per_month"]
        return source, monthly

    return "none", None


def estimate(inp: CostInputs) -> CostEstimate:
    """Run the cost model. Pure function; no I/O."""
    inp.validate()

    days = PRICEBOOK["days_per_month"]
    monthly_raw_gb = inp.daily_ingest_gb * days
    retained_raw_gb = inp.daily_ingest_gb * inp.retention_days
    retained_stored_gb = retained_raw_gb * inp.compression_ratio

    storage_cost = retained_stored_gb * inp.storage_usd_per_gb_month
    compute_cost = inp.compute_nodes * inp.compute_usd_per_node_month
    oo_monthly = storage_cost + compute_cost

    source, current_monthly = _resolve_current_monthly(inp)

    monthly_savings = None
    annual_savings = None
    savings_pct = None
    reduction_factor = None
    if current_monthly is not None:
        monthly_savings = current_monthly - oo_monthly
        annual_savings = monthly_savings * 12
        if current_monthly > 0:
            savings_pct = (monthly_savings / current_monthly) * 100
        if oo_monthly > 0:
            reduction_factor = current_monthly / oo_monthly

    return CostEstimate(
        daily_ingest_gb=inp.daily_ingest_gb,
        retention_days=inp.retention_days,
        monthly_raw_gb=monthly_raw_gb,
        retained_raw_gb=retained_raw_gb,
        retained_stored_gb=retained_stored_gb,
        compression_ratio=inp.compression_ratio,
        storage_cost_monthly=storage_cost,
        compute_cost_monthly=compute_cost,
        openobserve_monthly=oo_monthly,
        openobserve_annual=oo_monthly * 12,
        current_source=source,
        current_monthly=current_monthly,
        monthly_savings=monthly_savings,
        annual_savings=annual_savings,
        savings_pct=savings_pct,
        reduction_factor=reduction_factor,
        assumptions={
            "compression_ratio": inp.compression_ratio,
            "storage_usd_per_gb_month": inp.storage_usd_per_gb_month,
            "compute_nodes": inp.compute_nodes,
            "compute_usd_per_node_month": inp.compute_usd_per_node_month,
            "days_per_month": days,
            "provider_rates_usd_per_gb_day": dict(PRICEBOOK["providers"]),
        },
    )


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------
def _money(value: Optional[float]) -> str:
    if value is None:
        return "n/a"
    return f"${value:,.2f}"


def format_json(est: CostEstimate) -> str:
    return json.dumps(est.to_dict(), indent=2)


def format_text(est: CostEstimate) -> str:
    lines = []
    lines.append("OpenObserve Migration Accelerator - Cost Estimate")
    lines.append("=" * 58)
    lines.append("")
    lines.append("Volume")
    lines.append(f"  Daily ingest (raw)          : {est.daily_ingest_gb:,.2f} GB/day")
    lines.append(f"  Monthly ingest (raw)        : {est.monthly_raw_gb:,.2f} GB")
    lines.append(f"  Retention                   : {est.retention_days} days")
    lines.append(f"  Retained (raw)              : {est.retained_raw_gb:,.2f} GB")
    lines.append(
        f"  Retained (compressed)       : {est.retained_stored_gb:,.2f} GB "
        f"({est.compression_ratio:.2f} ratio)"
    )
    lines.append("")
    lines.append("OpenObserve estimated cost")
    lines.append(f"  Object storage / month      : {_money(est.storage_cost_monthly)}")
    lines.append(f"  Compute / month             : {_money(est.compute_cost_monthly)}")
    lines.append(f"  ----------------------------------------------")
    lines.append(f"  TOTAL / month               : {_money(est.openobserve_monthly)}")
    lines.append(f"  TOTAL / year                : {_money(est.openobserve_annual)}")
    lines.append("")
    lines.append("Comparison")
    lines.append(f"  Current source              : {est.current_source}")
    lines.append(f"  Current spend / month       : {_money(est.current_monthly)}")
    lines.append(f"  Estimated savings / month   : {_money(est.monthly_savings)}")
    lines.append(f"  Estimated savings / year    : {_money(est.annual_savings)}")
    if est.savings_pct is not None:
        lines.append(f"  Savings                     : {est.savings_pct:,.1f}%")
    if est.reduction_factor is not None:
        lines.append(f"  Cost reduction factor       : {est.reduction_factor:,.1f}x")
    lines.append("")
    lines.append("Assumptions (all overridable via CLI flags):")
    a = est.assumptions
    lines.append(f"  compression_ratio           : {a['compression_ratio']}")
    lines.append(f"  storage $/GB/month          : {a['storage_usd_per_gb_month']}")
    lines.append(f"  compute nodes x $/node/month: {a['compute_nodes']} x {a['compute_usd_per_node_month']}")
    return "\n".join(lines)


def format_markdown(est: CostEstimate) -> str:
    a = est.assumptions
    lines = [
        "# OpenObserve Cost Estimate",
        "",
        "> Generated by the OpenObserve Migration Accelerator cost estimator.",
        "> Figures are ballpark estimates for POC planning, not invoices.",
        "",
        "## Volume",
        "",
        "| Metric | Value |",
        "| --- | --- |",
        f"| Daily ingest (raw) | {est.daily_ingest_gb:,.2f} GB/day |",
        f"| Monthly ingest (raw) | {est.monthly_raw_gb:,.2f} GB |",
        f"| Retention | {est.retention_days} days |",
        f"| Retained (raw) | {est.retained_raw_gb:,.2f} GB |",
        f"| Retained (compressed, {est.compression_ratio:.2f}x count) | {est.retained_stored_gb:,.2f} GB |",
        "",
        "## OpenObserve estimated cost",
        "",
        "| Line item | Monthly |",
        "| --- | --- |",
        f"| Object storage | {_money(est.storage_cost_monthly)} |",
        f"| Compute | {_money(est.compute_cost_monthly)} |",
        f"| **Total** | **{_money(est.openobserve_monthly)}** |",
        f"| Annual | {_money(est.openobserve_annual)} |",
        "",
        "## Comparison",
        "",
        "| Metric | Value |",
        "| --- | --- |",
        f"| Current source | {est.current_source} |",
        f"| Current spend / month | {_money(est.current_monthly)} |",
        f"| Estimated savings / month | {_money(est.monthly_savings)} |",
        f"| Estimated savings / year | {_money(est.annual_savings)} |",
    ]
    if est.savings_pct is not None:
        lines.append(f"| Savings | {est.savings_pct:,.1f}% |")
    if est.reduction_factor is not None:
        lines.append(f"| Cost reduction factor | {est.reduction_factor:,.1f}x |")
    lines += [
        "",
        "## Assumptions",
        "",
        f"- Compression ratio: `{a['compression_ratio']}` (adaptive zstd/Parquet)",
        f"- Object storage: `${a['storage_usd_per_gb_month']}/GB/month`",
        f"- Compute: `{a['compute_nodes']}` node(s) x `${a['compute_usd_per_node_month']}/month`",
        f"- Days per month: `{a['days_per_month']}`",
        "- Provider fallback rates ($/GB/day/month): "
        + ", ".join(f"{k}={v}" for k, v in a["provider_rates_usd_per_gb_day"].items()),
        "",
    ]
    return "\n".join(lines)

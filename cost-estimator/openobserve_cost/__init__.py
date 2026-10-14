"""OpenObserve Migration Accelerator - cost estimation toolkit.

A small, dependency-free model for estimating OpenObserve storage + compute
cost from raw ingest volume and retention, and comparing that against what a
team currently pays Datadog, Splunk or Elastic.

The same model is mirrored in TypeScript for the web calculator
(``website/lib/costModel.ts``); keep the two in sync when changing assumptions.
"""

from .model import (  # noqa: F401
    CostInputs,
    CostEstimate,
    PRICEBOOK,
    estimate,
    format_markdown,
    format_text,
    format_json,
)

__version__ = "1.0.0"

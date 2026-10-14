"""Command-line interface for the OpenObserve cost estimator.

Examples
--------
    oo-cost --daily-gb 250 --retention-days 30 --source datadog
    oo-cost --daily-gb 1200 --retention-days 90 --current-spend 180000 --markdown
    oo-cost --daily-gb 50 --source splunk --json
    oo-cost --show-assumptions
"""

from __future__ import annotations

import argparse
import sys
from typing import Optional, Sequence, TextIO

from .model import (
    CostInputs,
    PRICEBOOK,
    estimate,
    format_json,
    format_markdown,
    format_text,
)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="oo-cost",
        description=(
            "Estimate OpenObserve ingest/storage cost and compare it with your "
            "current observability spend (Datadog, Splunk, Elastic)."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument(
        "--daily-gb",
        type=float,
        required=False,
        help="Raw (uncompressed) daily ingest volume in GB. Required unless "
        "--show-assumptions is used.",
    )
    p.add_argument(
        "--retention-days",
        type=int,
        default=30,
        help="How many days of data to keep on the searchable tier.",
    )
    p.add_argument(
        "--compression-ratio",
        type=float,
        default=PRICEBOOK["openobserve"]["compression_ratio"],
        help="Stored/raw size ratio after Parquet+zstd compression (0.10 = 10x).",
    )
    p.add_argument(
        "--storage-price",
        type=float,
        default=PRICEBOOK["openobserve"]["storage_usd_per_gb_month"],
        help="Object storage price, USD per GB per month.",
    )
    p.add_argument(
        "--compute-nodes",
        type=int,
        default=PRICEBOOK["openobserve"]["compute_nodes"],
        help="Number of OpenObserve compute nodes (size for HA in production).",
    )
    p.add_argument(
        "--compute-price",
        type=float,
        default=PRICEBOOK["openobserve"]["compute_usd_per_node_month"],
        help="USD per compute node per month.",
    )
    p.add_argument(
        "--current-spend",
        type=float,
        default=None,
        help="Your current total monthly observability spend in USD. "
        "Takes precedence over --source.",
    )
    p.add_argument(
        "--source",
        choices=sorted(PRICEBOOK["providers"].keys()),
        default=None,
        help="Current vendor, used only to *estimate* spend when "
        "--current-spend is not given.",
    )
    p.add_argument(
        "--source-rate",
        type=float,
        default=None,
        help="Override the fallback provider rate (USD per GB/day per month).",
    )
    p.add_argument("--json", action="store_true", help="Emit JSON instead of text.")
    p.add_argument(
        "--markdown",
        action="store_true",
        help="Emit a Markdown report (handy for pasting into a POC deck).",
    )
    p.add_argument(
        "--save-report",
        metavar="PATH",
        default=None,
        help="Write the chosen output format to a file as well as stdout.",
    )
    p.add_argument(
        "--show-assumptions",
        action="store_true",
        help="Print the model assumptions and exit.",
    )
    return p


def _print_assumptions(out: TextIO) -> None:
    oo = PRICEBOOK["openobserve"]
    print("OpenObserve Migration Accelerator - cost model assumptions", file=out)
    print("=" * 60, file=out)
    print("", file=out)
    print("OpenObserve storage is Parquet on object storage:", file=out)
    print(f"  compression_ratio        = {oo['compression_ratio']}  (adaptive zstd; 10x conservative)", file=out)
    print(f"  storage_usd_per_gb_month = {oo['storage_usd_per_gb_month']}  (S3 Standard list)", file=out)
    print(f"  compute_nodes x price    = {oo['compute_nodes']} x {oo['compute_usd_per_node_month']} USD/month", file=out)
    print("", file=out)
    print("Provider fallback rates, USD per GB/day/month (override with --source-rate):", file=out)
    for name, rate in PRICEBOOK["providers"].items():
        print(f"  {name:<10} = {rate}", file=out)
    print("", file=out)
    print("Notes:", file=out)
    print("  - Datadog log ingest list is $0.10/GB; indexing/retention adds more.", file=out)
    print("  - Splunk ingest list is ~$150/GB/day annual; contracts are discounted.", file=out)
    print("  - Elastic is a blended hot-tier estimate.", file=out)
    print("  - Always replace these with your negotiated rates before deciding.", file=out)


def main(argv: Optional[Sequence[str]] = None, out: Optional[TextIO] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    out = out or sys.stdout

    if args.show_assumptions:
        _print_assumptions(out)
        return 0

    if args.daily_gb is None:
        parser.error("--daily-gb is required (or use --show-assumptions)")

    try:
        inp = CostInputs(
            daily_ingest_gb=args.daily_gb,
            retention_days=args.retention_days,
            compression_ratio=args.compression_ratio,
            storage_usd_per_gb_month=args.storage_price,
            compute_nodes=args.compute_nodes,
            compute_usd_per_node_month=args.compute_price,
            current_spend_monthly=args.current_spend,
            source=args.source,
            source_usd_per_gb_day=args.source_rate,
        )
        result = estimate(inp)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    if args.json:
        rendered = format_json(result)
    elif args.markdown:
        rendered = format_markdown(result)
    else:
        rendered = format_text(result)

    print(rendered, file=out)

    if args.save_report:
        with open(args.save_report, "w", encoding="utf-8") as fh:
            fh.write(rendered + "\n")
        print(f"\n[oo-cost] report written to {args.save_report}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

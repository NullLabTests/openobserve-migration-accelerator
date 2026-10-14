# OpenObserve Cost Estimator (CLI)

A tiny, dependency-free Python tool that estimates what your telemetry would
cost on OpenObserve and compares it with what you pay today on Datadog, Splunk
or Elastic.

It answers one question well: **"If we move N GB/day of logs/metrics/traces to
OpenObserve with R days of retention, what does that cost — and what do we
save?"**

> The interactive web version of this calculator lives in [`../website`](../website).

## Install

Nothing to install if you have Python 3.9+ — run it in place:

```bash
cd cost-estimator
python3 -m openobserve_cost --daily-gb 250 --source datadog
```

Or install the `oo-cost` command:

```bash
cd cost-estimator
pip install .
oo-cost --daily-gb 250 --source datadog
```

## Usage

```
oo-cost --daily-gb 250 --retention-days 30 --source datadog
oo-cost --daily-gb 1200 --retention-days 90 --current-spend 180000 --markdown
oo-cost --daily-gb 50 --source splunk --json
oo-cost --show-assumptions
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--daily-gb` | – | Raw uncompressed ingest, GB/day (required) |
| `--retention-days` | `30` | Days kept on the searchable tier |
| `--compression-ratio` | `0.10` | Stored/raw ratio (0.10 = 10x compression) |
| `--storage-price` | `0.023` | Object storage USD/GB/month |
| `--compute-nodes` | `1` | OpenObserve compute nodes |
| `--compute-price` | `60` | USD per node/month |
| `--current-spend` | – | Your current monthly spend (takes precedence over `--source`) |
| `--source` | – | `datadog` \| `splunk` \| `elastic` (estimates spend if none given) |
| `--source-rate` | – | Override the fallback provider rate (USD/GB/day/month) |
| `--json` / `--markdown` | text | Output format |
| `--save-report PATH` | – | Also write the report to a file |
| `--show-assumptions` | – | Print the model assumptions |

### Example

```bash
$ python3 -m openobserve_cost --daily-gb 250 --retention-days 30 --source datadog
OpenObserve Migration Accelerator - Cost Estimate
==========================================================

Volume
  Daily ingest (raw)          : 250.00 GB/day
  Retention                   : 30 days
  Retained (compressed)       : 750.00 GB (0.10 ratio)

OpenObserve estimated cost
  Object storage / month      : $17.25
  Compute / month             : $60.00
  TOTAL / month               : $77.25
  TOTAL / year                : $927.00

Comparison
  Current source              : datadog
  Current spend / month       : $22,500.00
  Estimated savings / year    : $269,073.00
```

## The cost model

```
retained_raw_gb    = daily_ingest_gb * retention_days
retained_stored_gb = retained_raw_gb * compression_ratio
storage_cost       = retained_stored_gb * storage_usd_per_gb_month
compute_cost       = compute_nodes * compute_usd_per_node_month
openobserve_monthly = storage_cost + compute_cost
```

OpenObserve stores Parquet files on object storage (S3/GCS/Azure Blob) and
compresses with an adaptive zstd-based scheme, so a 10x reduction is a
**conservative** default; structured JSON logs often reach 15–20x.

### Assumptions to override before you trust the number

| Assumption | Default | Notes |
| --- | --- | --- |
| Compression ratio | `0.10` (10x) | Conservative; measure with your own payloads |
| Object storage | `$0.023`/GB/mo | S3 Standard list; S3 IA `$0.0125`, GCS `$0.020` |
| Compute | 1 node × `$60`/mo | Size to your query concurrency / HA needs |
| Datadog fallback | `$3.00`/GB/day/mo | Ingest-only floor ($0.10/GB × 30d); real bills add indexing |
| Splunk fallback | `$12.50`/GB/day/mo | From ~$150/GB/day annual list; contracts are discounted |
| Elastic fallback | `$1.50`/GB/day/mo | Blended hot-tier estimate |

**Real-world savings are typically far lower than the raw amount shown** — this
tool compares against list-ish ingest prices and ignores the engineering effort,
egress and dual-write period of a migration. Treat the output as a
conversation-starter for a POC, not a quote.

## Tests

```bash
cd cost-estimator
python3 -m pytest tests/ -q
```

## License

MIT — see [`../LICENSE`](../LICENSE).

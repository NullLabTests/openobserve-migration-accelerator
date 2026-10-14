# Migration Assets

Copy-pasteable recipes, dashboards and alerts for moving observability data to
OpenObserve — plus the [runbook](./MIGRATION-RUNBOOK.md) that sequences them.

Everything here pairs with the local demo stack in the repo root, so you can
try a recipe against a real OpenObserve in minutes.

## Start with the runbook

[`MIGRATION-RUNBOOK.md`](./MIGRATION-RUNBOOK.md) — phased plan (scope →
dual-write → validate → cut over → expand) with exit criteria, success metrics
and risks.

## Recipes by source

| Source | Folder | What's inside |
| --- | --- | --- |
| Datadog Agent / StatsD | [`datadog/`](./datadog/) | OTel Collector `datadog` + `statsd` receivers → OpenObserve |
| Fluent Bit | [`fluent-bit/`](./fluent-bit/) | `[OUTPUT]` block + Lua/remap for JSON → OTLP/HTTP |
| Vector | [`vector/`](./vector/) | `vector.toml` sink swapping Datadog/Elastic for OpenObserve |
| Splunk HEC / direct JSON | [`hec/`](./hec/) | HEC-compatible endpoint + direct JSON/HTTP ingest examples |
| Kubernetes | [`kubernetes/`](./kubernetes/) | Helm values for the OTel Collector + notes on DaemonSet vs. gateway |

## Dashboards & alerts

| Folder | What's inside |
| --- | --- |
| [`dashboards/`](./dashboards/) | Service overview, cost/volume tracking, trace↔log correlation |
| [`alerts/`](./alerts/) | High error rate, high latency, volume drop (JSON + SQL) |

> **OpenObserve version note:** dashboard and alert JSON schemas evolve. The
> files here follow the documented v5/v8 shapes. If an import is rejected on
> your version, use the same-folder `README.md` SQL to recreate in the UI — the
> queries are the durable part.

## Design principles used throughout

1. **Dual-write first.** Never remove the incumbent until parity is proven.
2. **OTLP is the lingua franca.** Agents forward into a collector; the collector
   speaks OpenObserve. Apps instrument once, ship anywhere.
3. **Object storage, not hot disks.** Point OpenObserve at S3/GCS/Azure Blob for
   production; the compression is where the economics come from.
4. **Tag the migration.** `migration_phase=dual-write` on everything makes it
   trivial to attribute and delete later.

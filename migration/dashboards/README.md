# OpenObserve Dashboards

Three ready examples that map directly onto the demo stack (and onto a real
migration's acceptance tests):

| File | Covers |
| --- | --- |
| [`service-overview.json`](./service-overview.json) | Request rate, error rate, latency, slowest operations |
| [`cost-volume.json`](./cost-volume.json) | Log volume over time, volume by service, raw bytes |
| [`trace-log-correlation.json`](./trace-log-correlation.json) | trace_id on logs and spans for cross-signal pivots |

## Import

1. OpenObserve UI → **Dashboards** → **Import**.
2. Select the JSON file → **Import**.
3. Open the dashboard (it lands in the default folder).

> **Version note.** Dashboard schemas are versioned and evolve. These files use
> the documented `version: 5` shape (`tabs[].panels[].queries[].fields` with
> snake_case `stream_type`). If your OpenObserve rejects an import, rebuild the
> panel in the UI and paste the SQL from the table below — the **query is the
> durable part**, the JSON wrapper is not.

## The queries (copy-paste into a panel)

### Service overview (traces)

```sql
-- Request rate (spans/min)
SELECT histogram(_timestamp, '1 minute') AS x_axis_1, count(*) AS y_axis_1
FROM "checkout-api" GROUP BY x_axis_1 ORDER BY x_axis_1;

-- Error spans/min
SELECT histogram(_timestamp, '1 minute') AS x_axis_1, count(*) AS y_axis_1
FROM "checkout-api" WHERE span_status = 'ERROR' GROUP BY x_axis_1 ORDER BY x_axis_1;

-- Average latency (µs). For p95, use:
--   approx_percentile_cont(CAST(duration AS DOUBLE), 0.95) AS y_axis_1
SELECT histogram(_timestamp, '1 minute') AS x_axis_1,
       avg(CAST(duration AS DOUBLE)) AS y_axis_1
FROM "checkout-api" GROUP BY x_axis_1 ORDER BY x_axis_1;

-- Slowest operations
SELECT operation_name, count(*) AS spans,
       avg(CAST(duration AS DOUBLE))/1000 AS avg_ms,
       max(CAST(duration AS DOUBLE))/1000 AS max_ms
FROM "checkout-api" GROUP BY operation_name ORDER BY avg_ms DESC;
```

### Cost & volume (logs)

```sql
-- Events/min
SELECT histogram(_timestamp, '1 minute') AS x_axis_1, count(*) AS y_axis_1
FROM "default" WHERE service IS NOT NULL GROUP BY x_axis_1 ORDER BY x_axis_1;

-- Volume by service
SELECT service AS x_axis_1, count(*) AS y_axis_1
FROM "default" WHERE service IS NOT NULL GROUP BY x_axis_1 ORDER BY y_axis_1 DESC;
```

### Trace ↔ log correlation

```sql
-- Error logs, newest first (trace_id lets you pivot to the trace)
SELECT _timestamp, service, message, trace_id
FROM "default" WHERE level = 'error' ORDER BY _timestamp DESC;

-- Slow spans with their trace_id
SELECT trace_id, service_name, operation_name,
       CAST(duration AS DOUBLE)/1000 AS duration_ms, span_status
FROM "checkout-api" ORDER BY duration DESC;
```

## Field-name notes

These dashboards target the bundled demo app, which uses the OTel semantic
conventions. Confirm the exact field names in UI → **Streams** → your stream
before adapting to production data:

| Concept | Demo field | Notes |
| --- | --- | --- |
| Span duration | `duration` | Microseconds (OTLP) |
| Span status | `span_status` | `OK` / `ERROR` / `UNSET` |
| Service | `service_name` (traces), `service` (demo logs) | OTel `service.name` |
| Log level | `level` | Set via our structured logger |
| Trace correlation | `trace_id` | Auto-attached when logs emit inside a span |

## Cost modeling

OpenObserve stores Parquet on object storage. To turn these volume numbers into
dollars, use the [cost estimator](../../cost-estimator) with the same retention
and compression assumptions.

# OpenObserve Alert Rules

Three starter alerts that cover the "did the migration break anything?" cases:

| File | Fires when |
| --- | --- |
| [`high-error-rate.json`](./high-error-rate.json) | Error spans exceed threshold in a window |
| [`high-latency.json`](./high-latency.json) | Too many spans slower than 500ms |
| [`volume-drop.json`](./volume-drop.json) | Log volume collapses (pipeline down) |

## Import

**UI:** Alerts → **Import** (or create manually and paste the SQL). Set a real
destination (Slack/PagerDuty/email/webhook) in place of `slack-alerts`.

**API:**

```bash
curl -s -X POST "http://localhost:5080/api/default/alerts" \
  -u "root@example.com:Complexpass#123" \
  -H "Content-Type: application/json" \
  --data @high-error-rate.json
```

(Remove `destinations` first if the named destination doesn't exist, or create it
under Alerts → Destinations.)

## The SQL

```sql
-- High error rate (stream_type: traces, stream_name: checkout-api)
SELECT count(*) AS err_count
FROM "checkout-api" WHERE span_status = 'ERROR';

-- High latency (stream_type: traces)
SELECT count(*) AS slow_spans
FROM "checkout-api" WHERE CAST(duration AS DOUBLE) > 500000;   -- 500ms in µs

-- Volume drop (stream_type: logs, operator: <=)
SELECT count(*) AS events
FROM "default" WHERE service IS NOT NULL;
```

## Field notes

- Scheduled alerts **must not** use `SELECT *` — select explicit columns.
- `duration` is microseconds. `500000` = 500ms; adjust for your SLO.
- `operator` accepts comparison operators (`>=`, `>`, `<=`, `<`). Use `<=` for
  "volume dropped" style alerts.
- Alert **names** must be snake_case (letters, digits, underscores).

## Mapping from incumbent alerts

| Typical incumbent alert | OpenObserve equivalent |
| --- | --- |
| Datadog "APM error rate > X" | `high-error-rate.json` (traces, span_status) |
| Datadog "trace.p95 > X" | `high-latency.json` (count over duration threshold) |
| Splunk "no events in N minutes" | `volume-drop.json` |
| Elastic watcher on error count | `high-error-rate.json` |

For ratios (error **rate**) and true p95/p99, use a **PromQL** condition on the
generated `*_count`/`*_bucket` metric streams, or a VRL function to compare two
windows (see the OpenObserve scheduled-alerts docs).

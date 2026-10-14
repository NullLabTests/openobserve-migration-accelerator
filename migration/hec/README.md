# Direct JSON & HEC-style ingest

Two ways to get data into OpenObserve without changing your app's SDK:

1. **Direct JSON** — post NDJSON to OpenObserve's HTTP ingest API.
2. **HEC-style** — keep emitting Splunk HEC and convert it with the
   OpenTelemetry Collector's `splunk_hec` receiver. Great when apps/agents are
   hard-wired to HEC.

All endpoints assume the local demo stack (`http://localhost:5080`). In
production use HTTPS and an ingestion token.

---

## 1. Direct JSON ingest

Endpoint shape:

```
POST /api/<org_id>/<stream_name>/_json        # one JSON document or an array
POST /api/<org_id>/<stream_name>/_multi       # newline-delimited JSON (NDJSON)
```

Auth is HTTP Basic (`base64("email:password")`) **or** an ingestion token sent as
`Authorization: Bearer <token>`.

### Single document / array

```bash
curl -s -X POST "http://localhost:5080/api/default/demo_logs/_json" \
  -u "root@example.com:Complexpass#123" \
  -H "Content-Type: application/json" \
  -d '[{"level":"info","message":"hello from direct json","service":"manual","order_id":"ord-1"}]'
```

### Bulk NDJSON (recommended for volume)

```bash
curl -s -X POST "http://localhost:5080/api/default/demo_logs/_multi" \
  -u "root@example.com:Complexpass#123" \
  -H "Content-Type: application/json" \
  --data-binary $'{"level":"info","message":"first"}\n{"level":"warn","message":"second"}'
```

Python:

```python
import base64, json, urllib.request

auth = base64.b64encode(b"root@example.com:Complexpass#123").decode()
req = urllib.request.Request(
    "http://localhost:5080/api/default/demo_logs/_json",
    data=json.dumps([{"level": "info", "message": "from python"}]).encode(),
    headers={"Content-Type": "application/json", "Authorization": f"Basic {auth}"},
)
urllib.request.urlopen(req).read()
```

Use this path for: CI scripts, one-off backfills, Lambda/Functions that can't
run an SDK, or a "can the network reach OpenObserve" smoke test.

---

## 2. HEC-style ingest (Splunk → OpenObserve)

If your producers speak the Splunk HTTP Event Collector protocol, don't rewrite
them. Run an OpenTelemetry Collector with the `splunk_hec` receiver and export
to OpenObserve:

```yaml
# otel-collector-hec.yaml
receivers:
  splunk_hec:
    endpoint: 0.0.0.0:8088
    # HEC token your producers already send:
    token: "00000000-0000-0000-0000-000000000000"
    splunk_app_name: "migration"
    splunk_app_version: "1.0"

processors:
  batch: {}
  attributes/migration:
    actions:
      - key: migration_phase
        value: dual-write
        action: upsert

exporters:
  otlphttp/openobserve:
    endpoint: http://openobserve:5080/api/default
    headers:
      Authorization: "Basic cm9vdEBleGFtcGxlLmNvbTpDb21wbGV4cGFzcyMxMjM="
      stream-name: splunk_hec

service:
  pipelines:
    logs:
      receivers: [splunk_hec]
      processors: [attributes/migration, batch]
      exporters: [otlphttp/openobserve]
```

Point your existing forwarders at `http://<collector>:8088/services/collector/event`:

```bash
curl -s -X POST "http://localhost:8088/services/collector/event" \
  -H "Authorization: Splunk 00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -d '{"event":"HEC event via collector","sourcetype":"_json","index":"main"}'
```

The same pattern works for other legacy receivers the collector ships:
`syslog`, `fluentforward`, `filelog`, `journald`, `kafka`, `loki`, and more.

---

## Auth cheat-sheet

| Method | Header | Notes |
| --- | --- | --- |
| Basic | `Authorization: Basic base64(email:password)` | Simplest for a POC |
| Ingestion token | `Authorization: Bearer <token>` | Generate under Data sources → Tokens |
| HEC | `Authorization: Splunk <hec-token>` | Only on the collector's `splunk_hec` receiver |

## Verify

```bash
# Count documents that landed in the demo_logs stream
# start_time/end_time are epoch microseconds (0 = open range); size=0 returns just the count.
curl -s -X POST "http://localhost:5080/api/default/_search?type=logs" \
  -u "root@example.com:Complexpass#123" \
  -H "Content-Type: application/json" \
  -d '{"query":{"sql":"SELECT count(*) FROM demo_logs","start_time":0,"end_time":0,"from":0,"size":0}}'
```

Then open OpenObserve UI → **Logs** → stream `demo_logs`.

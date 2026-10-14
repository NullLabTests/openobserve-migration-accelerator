# Fluent Bit → OpenObserve

Add OpenObserve as a second `[OUTPUT]`. Keep your Datadog/Elastic output block
in place during the pilot.

## Recommended: via the OTel Collector

Use the `opentelemetry` output to the collector's OTLP/HTTP port (4318). The
collector adds batching, auth, retries and sends to OpenObserve. See
[`fluent-bit.conf`](./fluent-bit.conf).

```ini
[OUTPUT]
    Name          opentelemetry
    Match         kube.*
    Host          otel-collector
    Port          4318
    http_uri      /v1/logs
    add_label     migration_phase dual-write
```

Requires Fluent Bit ≥ 1.8 (anything you have today).

## Fallback: direct JSON to OpenObserve

If you can't run a collector, post NDJSON directly with the `http` output (see
the commented block in the config). The endpoint format is:

```
POST http://<openobserve>:5080/api/<org>/<stream>/_json
Authorization: Basic <base64(email:password)>
Content-Type: application/json
```

## Verify

```bash
# Watch Fluent Bit self-metrics for retries on the new output
curl -s http://localhost:2020/api/v1/metrics | grep -i output
```

Then confirm the stream in OpenObserve UI → **Logs**.

# Datadog → OpenTelemetry Collector → OpenObserve

Keep the Datadog Agent exactly as it is and add OpenObserve as a parallel
destination. Nothing breaks; you gain a second copy of the data to validate.

## What's in this folder

- [`otel-collector-datadog.yaml`](./otel-collector-datadog.yaml) — a collector
  config with `statsd` (DogStatsD metrics), `datadog` (agent traces) and `otlp`
  receivers, all exporting to OpenObserve.

## Metrics (DogStatsD)

1. Start the collector from this folder's config (set `OPENOBSERVE_AUTH`).
2. On the Datadog Agent host, set:

   ```bash
   DD_DOGSTATSD_URL=udp://<collector-host>:8125
   ```

3. Confirm metrics land: OpenObserve UI → **Metrics** → you should see the
   StatsD metrics within ~1 minute.

## Traces (APM)

Datadog Agent 7.55+/6.69+ can forward traces over OTLP:

```bash
DD_APM_ADDITIONAL_ENDPOINTS='{"http://<collector-host>:8126": ["pilot"]}'
```

The collector's `datadog` receiver ingests them and exports to OpenObserve.
Traces from services using the Datadog tracing library are also accepted.

## Logs

The most reliable path is to skip the Datadog Agent for logs and tail them with
the collector's `filelog` receiver:

```yaml
receivers:
  filelog:
    include: [/var/log/pods/*/*/*.log]
    operators:
      - type: json_parser
        timestamp:
          parse_from: attributes.time
          layout: "%Y-%m-%dT%H:%M:%S.%LZ"
```

If you must keep logs in the Datadog Agent, configure
`logs_config.additional_endpoints` to POST the same payloads to a collector HTTP
endpoint (see [`../hec/`](../hec/)).

## Verify

```bash
# Collector should be receiving on the statsd port and exporting without errors
curl -s http://localhost:8888/metrics | grep 'otelcol_exporter_send_failed'
```

`sent_*` should climb; `send_failed_*` should stay at 0.

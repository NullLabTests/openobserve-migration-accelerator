# Kubernetes → OpenObserve (OTel Collector Helm)

Deploy the OpenTelemetry Collector on Kubernetes and export to OpenObserve.
This is the standard path: one Collector (or a DaemonSet of agents + a gateway)
receives from pods and ships everything to OpenObserve.

## Two topologies

| Topology | When to use | Trade-off |
| --- | --- | --- |
| **DaemonSet (agent)** | Simple clusters; logs from node files | One collector per node; less routing control |
| **Gateway (Deployment)** | High volume; central sampling/routing; auth in one place | Extra hop; needs HPA |

Most teams start with a **DaemonSet of agents** that scrape logs and OTLP, and
add a **gateway Deployment** later if routing/sampling grows.

## Install with the official chart

```bash
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

# Create the auth header secret (never inline base64 creds in values)
kubectl create secret generic openobserve-collector-auth \
  --from-literal=OPENOBSERVE_AUTH="Basic $(printf '%s' 'root@example.com:Complexpass#123' | base64)"
```

`collector-values.yaml` (agent mode, minimal):

```yaml
mode: daemonset

image:
  repository: otel/opentelemetry-collector-contrib

presets:
  logsCollection:
    enabled: true          # tails and ships pod logs
  kubeletMetrics:
    enabled: true          # node/pod resource metrics
  kubernetesAttributes:
    enabled: true          # adds k8s.* resource attributes

extraEnvs:
  - name: OPENOBSERVE_AUTH
    valueFrom:
      secretKeyRef:
        name: openobserve-collector-auth
        key: OPENOBSERVE_AUTH

config:
  receivers:
    otlp:
      protocols:
        grpc: { endpoint: 0.0.0.0:4317 }
        http: { endpoint: 0.0.0.0:4318 }

  processors:
    batch: {}
    k8sattributes: {}
    resource:
      attributes:
        - key: deployment.environment
          value: production
          action: upsert

  exporters:
    otlphttp/openobserve:
      endpoint: http://openobserve.openobserve.svc.cluster.local:5080/api/default
      headers:
        Authorization: ${env:OPENOBSERVE_AUTH}
      compression: gzip

  service:
    pipelines:
      traces:
        receivers: [otlp]
        processors: [k8sattributes, resource, batch]
        exporters: [otlphttp/openobserve]
      metrics:
        receivers: [otlp]
        processors: [k8sattributes, resource, batch]
        exporters: [otlphttp/openobserve]
      logs:
        receivers: [otlp]
        processors: [k8sattributes, resource, batch]
        exporters: [otlphttp/openobserve]
```

```bash
helm upgrade --install oo-collector open-telemetry/opentelemetry-collector \
  -n observability --create-namespace -f collector-values.yaml
```

## Point your apps at it

Set the standard OTel env vars on your workloads:

```yaml
env:
  - name: OTEL_EXPORTER_OTLP_ENDPOINT
    value: http://oo-collector-opentelemetry-collector.observability:4318
  - name: OTEL_EXPORTER_OTLP_PROTOCOL
    value: http/protobuf
  - name: OTEL_SERVICE_NAME
    valueFrom: { fieldRef: { fieldPath: metadata.labels['app'] } }
  - name: OTEL_RESOURCE_ATTRIBUTES
    value: k8s.namespace.name=$(POD_NAMESPACE),deployment.environment=production
```

## Auto-instrumentation (optional)

The OpenTelemetry Operator can inject instrumentation without code changes:

```bash
kubectl apply -f - <<'YAML'
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: default
  namespace: default
spec:
  exporter:
    endpoint: http://oo-collector-opentelemetry-collector.observability:4318
  propagators: [tracecontext, baggage]
  sampler:
    type: parentbased_traceidratio
    argument: "0.25"          # 25% during dual-write to cap cost
YAML
```

Then annotate a pod/deployment: `instrumentation.opentelemetry.io/inject-nodejs: "true"`.

## Production notes

- **Point OpenObserve at object storage** (S3/GCS/Azure Blob). The economics
  come from Parquet-on-object-storage, not from local disks.
- **One gateway = one auth point.** Inline the header into the collector config
  only from a mounted secret; rotate the secret and restart the collector.
- **Sampling during dual-write.** Use `parentbased_traceidratio` to send a
  fraction to OpenObserve while validating.
- **Don't forget HPA** on a gateway Deployment, and `memory_limiter` on every
  collector to avoid OOM under bursts.
- **Namespace + pod labels** come from `k8sattributes`; without it your
  dashboards can't slice by workload.

## Verify

```bash
kubectl -n observability logs deploy/oo-collector-opentelemetry-collector | tail -50
# Look for: "Everything is ready. Begin running and processing data."
kubectl -n observability port-forward svc/oo-collector-opentelemetry-collector 8888:8888
curl -s localhost:8888/metrics | grep otelcol_exporter_sent
```

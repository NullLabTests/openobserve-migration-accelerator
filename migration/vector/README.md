# Vector → OpenObserve

Add an `http` sink pointing at OpenObserve. Vector sends JSON; OpenObserve
ingests it directly — no collector required.

## Install

Copy [`vector.toml`](./vector.toml) next to your existing Vector config and
merge the `openobserve_logs` sink (and the `tag_migration` transform). Keep your
Datadog/Elastic sinks in place.

## Ingest endpoint

```
POST http://<openobserve>:5080/api/<org>/<stream>/_json
Authorization: Basic <base64(email:password)>   (or Bearer <ingestion-token>)
Content-Type: application/json
Content-Encoding: gzip        # optional
```

## Verify

```bash
curl -s http://localhost:8686/health
curl -s http://localhost:8686/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ componentByComponentKey(componentKey:\"openobserve_logs\"){ metrics{ receivedEventsTotal{ receivedEventsTotal } } } }"}'
```

Then check the `vector_logs` stream in OpenObserve.

## Notes

- Use a **Vector environment variable** for the password in real deployments
  (`password = "${OPENOBSERVE_PASSWORD}"`), never a literal.
- For metrics, prefer routing through the OTel Collector (see the commented
  `opentelemetry` sink) so histograms and exemplars survive intact.

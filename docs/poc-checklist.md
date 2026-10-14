# POC Checklist

A runnable script for a 60–90 minute OpenObserve POC. Copy this into your notes
and tick items off. Each item says **what to do** and **what "good" looks like**.

## 0. Prep (10 min)

- [ ] Docker + Docker Compose v2 installed (`docker compose version`).
- [ ] Ports 5080 and 5081 are free (`ss -ltnp | grep -E '5080|5081'`).
- [ ] Clone the repo, `cp .env.example .env`.
- [ ] Optional: adjust `.env` credentials if the machine is shared.

## 1. Bring the stack up (10 min)

- [ ] `docker compose up -d`
- [ ] `docker compose ps` — every service is `running`/`healthy`.
- [ ] `docker compose logs otel-collector | grep -i error` — no export errors.
- [ ] Open http://localhost:5080 and log in.

## 2. Logs land and correlate (10 min)

- [ ] **Logs** → stream `default` shows events from `checkout-api` / `orders-api`.
- [ ] Filter `level = 'error'` — you see error lines from loadgen's injected failures.
- [ ] Expand an error row and note the **`trace_id`**.

## 3. Traces tell the same story (15 min)

- [ ] **Traces** → stream `checkout-api` shows spans.
- [ ] Open a trace: you see the `checkout-api` root span **and** an `orders-api`
      child span (`orders.process`) — a real distributed trace.
- [ ] Search a `trace_id` from step 2 here — you land on the same request.
- [ ] Duration is in **microseconds** (`duration`).

## 4. Metrics (10 min)

- [ ] **Metrics** → find `demo_requests_total` and `demo_request_duration`.
- [ ] The HTTP server metrics (`http_server_duration_*`) are present too.

## 5. Import the migration assets (15 min)

- [ ] **Dashboards → Import**:
      [`service-overview.json`](../migration/dashboards/service-overview.json),
      [`cost-volume.json`](../migration/dashboards/cost-volume.json),
      [`trace-log-correlation.json`](../migration/dashboards/trace-log-correlation.json).
- [ ] Panels render with data. If an import is rejected (schema drift), rebuild
      the panel and paste the SQL from
      [`migration/dashboards/README.md`](../migration/dashboards/README.md).
- [ ] **Alerts**: import the three rules from [`migration/alerts/`](../migration/alerts/)
      (remove `destinations` or create the destination first).
- [ ] Trigger an alert: stop `loadgen` (`docker compose stop loadgen`) and watch
      `log_volume_drop` go off after its window.

## 6. Model the money (10 min)

- [ ] `cd cost-estimator && python3 -m openobserve_cost --daily-gb 250 --retention-days 30 --source datadog`
- [ ] Open the **website** calculator, enter the same numbers, confirm it matches.
- [ ] Record your **real** daily GB and vendor rate; note the savings range.

## 7. Review the migration path (10 min)

- [ ] Read [`migration/MIGRATION-RUNBOOK.md`](../migration/MIGRATION-RUNBOOK.md).
- [ ] Pick your ingestion path: [Datadog](../migration/datadog/),
      [Fluent Bit](../migration/fluent-bit/), [Vector](../migration/vector/),
      [HEC/direct](../migration/hec/), [Kubernetes](../migration/kubernetes/).
- [ ] Identify one pilot service and one dashboard you must reach parity on.

## 8. Teardown

- [ ] `docker compose down -v` (deletes the data volume).

---

## Success criteria (the POC "passes" if…)

- [ ] Logs, metrics and traces all arrive via one collector.
- [ ] A single request is traceable end-to-end across two services.
- [ ] You can pivot from an error log to its trace by `trace_id`.
- [ ] At least one dashboard and one alert render/import successfully.
- [ ] The cost model produces a defensible savings number for your volume.

## Known caveats

- **Schemas drift.** Dashboard/alert JSON is versioned; treat the **SQL** as the
  durable artifact and re-create panels in the UI if imports fail.
- **Field names.** Confirm in UI → Streams before wiring production dashboards;
  OTel semantic-convention names can differ by instrumentation.
- **← This environment.** If Docker isn't available, the compose stack can't be
  run here; validate configs offline (see [`CONTRIBUTING.md`](../CONTRIBUTING.md))
  and run the POC on a machine with Docker.

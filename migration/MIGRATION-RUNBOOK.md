# OpenObserve Migration Runbook

A phased, low-risk playbook for moving telemetry from Datadog, Splunk or
Elastic to OpenObserve. Written so a Customer Success engineer can hand it to a
customer and walk the phases together.

> **Golden rule:** never stop sending to the incumbent until OpenObserve has
> proven it can answer your most important questions, _and_ your alerts have
> fired correctly in a game day. Migrations fail when the cutover is a leap of
> faith; this runbook makes it boring.

---

## Phase 0 — Scope & baseline (week 0)

**Goal:** agree on what "done" means and what it costs today.

- [ ] Inventory sources: which agents/SDKs emit logs, metrics and traces, and to
      where (`datadog-agent`, `splunk-forwarder`, `filebeat`, OTLP, ...).
- [ ] Record current daily ingest (GB/day), retention, and monthly spend per
      vendor. Use the [cost estimator](../cost-estimator) for a first model.
- [ ] Pick **one** pilot service. Prefer a high-volume, well-understood service
      so the savings are visible.
- [ ] List the top 5 dashboards and top 10 alerts the pilot team actually uses.
      These are the acceptance tests.
- [ ] Agree success criteria (see the end of this document).

**Exit criteria:** signed-off scope, baseline volume + cost, named pilot service
and owners.

---

## Phase 1 — Stand up the stack (week 1)

**Goal:** a working OpenObserve with a pipeline proven end to end.

- [ ] Deploy the local demo stack and confirm data flows:

      docker compose up -d
      # UI http://localhost:5080  (root@example.com / Complexpass#123)

- [ ] In production, stand up OpenObserve (single node is fine for a POC; use
      object storage such as S3/GCS/Azure Blob, not local disk).
- [ ] Deploy an OpenTelemetry Collector (see
      [`kubernetes/`](./kubernetes/)) with an OTLP receiver and the
      OpenObserve exporter. Confirm the collector can reach
      `http://<openobserve>:5080/api/<org>`.
- [ ] Confirm the collector's own metrics show `otelcol_exporter_sent_*`
      increasing and `otelcol_exporter_send_failed_*` at zero.

**Exit criteria:** a synthetic OTLP signal appears in OpenObserve's Streams UI.

---

## Phase 2 — Dual-write (weeks 1–2)

**Goal:** send the pilot service to **both** backends. Zero risk to the
incumbent.

- [ ] Point the pilot's OTel SDK exporter at the collector (keep the existing
      Datadog/Splunk pipeline untouched).
- [ ] For agents you can't easily re-point (Datadog Agent, Fluent Bit, Vector,
      HEC), add a parallel output. Copy the closest recipe from:
      [`datadog/`](./datadog/), [`fluent-bit/`](./fluent-bit/),
      [`vector/`](./vector/), [`hec/`](./hec/).
- [ ] Sample aggressively if volume is a concern: 100% is ideal, but 10–25% is
      enough to validate dashboards while limiting cost during the dual-write
      window.
- [ ] Tag everything with `migration_phase=dual-write` so data is easy to
      attribute and later delete.

**Exit criteria:** the pilot's logs, metrics and traces are visible in both
backends, with matching volume within an agreed tolerance (e.g. ±5%).

---

## Phase 3 — Validate parity (weeks 2–3)

**Goal:** prove OpenObserve answers the pilot team's real questions.

- [ ] Rebuild the top-5 dashboards in OpenObserve.
      Start from [`dashboards/`](./dashboards/).
- [ ] Recreate the top-10 alerts. Start from [`alerts/`](./alerts/).
- [ ] Compare, side by side, for at least 3 business days:
  - [ ] request rate / error rate / p95 latency per service,
  - [ ] log volume and top error messages,
  - [ ] trace→log correlation for a known incident.
- [ ] Run a **game day**: inject a fault, confirm OpenObserve alerts fire within
      your SLO, and confirm runbook links work.
- [ ] Record any gaps (missing field, unsupported chart, query that is awkward).

**Exit criteria:** dashboard numbers match within tolerance; alerts fire
correctly; the pilot team says "we could work in this."

---

## Phase 4 — Cut over (week 4)

**Goal:** OpenObserve becomes the primary; the incumbent becomes the archive.

- [ ] Hoist dashboards/alerts from the pilot to the default shared set.
- [ ] Update runbooks and on-call docs to point at OpenObserve.
- [ ] Stop sending new data to the incumbent for the pilot (keep the data for
      as long as compliance requires).
- [ ] Keep a **7-day rollback window**: the dual-write configs stay in Git and
      can be re-enabled with one change if a blocker appears.

**Exit criteria:** incumbent ingest for the pilot drops to zero; no P1 regressions
in week one of the cutover.

---

## Phase 5 — Expand & decommission (weeks 5+)

- [ ] Roll the same Phases 2–4 across the remaining services in waves.
- [ ] Right-size retention (hot vs. long-term) using the cost estimator.
- [ ] Export/downgrade incumbent data, then cancel the contract once retention
      obligations are met.
- [ ] Celebrate. You just cut a line item.

---

## Success criteria (agree these up front)

| Dimension | Target (example) |
| --- | --- |
| Data completeness | ≥ 99% of pilot volume in OpenObserve vs. incumbent |
| Query parity | top-5 dashboards match within ±5% |
| Alert parity | 10/10 alerts fire in game day |
| Latency to query | p95 query < 3s for standard dashboards |
| Cost | ≥ 60% run-rate reduction at steady state (measured, not modeled) |
| Rollback | ≤ 1 change to restore incumbent-only flow |

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Field-name differences break dashboards | Validate in Phase 3; keep a mapping doc |
| Alert logic doesn't translate 1:1 | Rebuild from the SQL in [`alerts/`](./alerts/) |
| Dual-write cost spike | Sample during dual-write; time-box the window |
| Support cover gap during cutover | Keep rollback window; stage by service |
| Compliance/retention rules | Confirm data residency + retention before decommission |

## Appendix — Order of operations at a glance

```
baseline ──► stack up ──► dual-write ──► validate ──► cut over ──► expand
   │            │             │             │            │            │
 scope      collector      parallel      parity +     primary     waves +
 + cost     + storage      outputs       game day     7-day       decommission
   model      (object                     tests      rollback
              storage)
```

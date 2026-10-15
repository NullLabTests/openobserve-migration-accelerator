# Contributing

Thanks for helping make OpenObserve migrations easier. This repo optimizes for
**copy-pasteable, runnable artifacts** — if a config doesn't work when pasted
into a real environment, it's a bug.

## Ground rules

- **No secrets, ever.** The only credentials in the repo are the documented
  local demo ones. Use placeholders (`${env:...}`) in configs.
- **Keep configs copy-pasteable.** Prefer complete, standalone snippets over
  fragments. Comment the non-obvious lines.
- **Version-dependent things get a note.** Dashboard/alert JSON schemas drift;
  document the version and lead with the SQL.
- **Small, focused PRs.** One recipe / one dashboard / one fix.

## Repo layout

| Dir | Language | Test |
| --- | --- | --- |
| `cost-estimator/` | Python | `pytest` |
| `website/` | TypeScript (Next.js) | `npm run build` |
| `demo-app/`, `ai-observability/` | Node.js | boot + OTLP smoke |
| `config/`, `migration/` | YAML/JSON | parse + `docker compose config` |

## Running checks locally

```bash
# Python cost model
cd cost-estimator && python3 -m pytest tests/ -q

# Website
cd website && npm ci && npm run build

# Compose + collector config (needs Docker)
docker compose config -q

# All JSON parses
find . -name '*.json' -not -path '*/node_modules/*' -not -path '*/.next/*' \
  -not -path '*/out/*' -not -name 'package-lock.json' \
  -exec python3 -c 'import json,sys; json.load(open(sys.argv[1]))' {} \;
```

CI runs the same set on every PR ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)).

## Adding a migration recipe

1. Create `migration/<source>/` with a runnable config and a `README.md`.
2. The README should answer: **what it does**, **how to run it**, **environment
   variables**, and **what to watch for** during cutover.
3. Prefer a dual-write setup (send to old + new) so teams can validate parity
   before cutting over.
4. Add a row to the tables in [`migration/README.md`](./migration/README.md).

## Adding a dashboard

1. Add `migration/dashboards/<name>.json`.
2. Add the SQL to [`migration/dashboards/README.md`](./migration/dashboards/README.md)
   — the SQL is what people actually copy.
3. Note the stream/field it depends on.

## Code style

- Match the surrounding file. **No comments explaining *what* — only *why*.**
- Keep the cost model identical between `cost-estimator/` (Python) and
  `website/lib/costModel.ts` (TS); the two are maintained by hand, so update
  both together.
- Don't add dependencies without a reason.

## Reporting issues

Include: what you ran, what you expected, what happened, and (for schema issues)
your OpenObserve version. Screenshots of the UI help a lot.

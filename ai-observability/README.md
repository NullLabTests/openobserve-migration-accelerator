# AI / LLM Observability (bonus)

A tiny agent loop that emits **OpenTelemetry `gen_ai.*` spans** so you can see
LLM calls, token usage and tool calls in the same OpenObserve as your infra
telemetry. This is the "AI observability" story applied to the migration
toolkit.

> No API key, no real model call — token counts and latency are synthesized.
> Replace the `callModel()` body with your real provider SDK and keep the same
> span/attribute shape.

## What it emits

```
invoke_agent                         (root span, agent.task, total tokens)
├── chat gpt-4o-mini                 (model call)
│    events: gen_ai.content.prompt, gen_ai.content.completion
│    attrs:  gen_ai.request.model, gen_ai.usage.input_tokens/output_tokens, ...
└── execute_tool search_docs         (tool call)
```

Attribute names follow the [OTel GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/):
`gen_ai.system`, `gen_ai.operation.name`, `gen_ai.request.model`,
`gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, etc.

## Run it

With the demo stack already up:

```bash
docker compose --profile ai up -d --build
docker compose logs -f ai-agent
```

Then in OpenObserve: **Traces** → stream `ai-agent-demo`. Open an `invoke_agent`
trace to see the model and tool child spans, token counts, and prompt/completion
events.

### Standalone (against the local collector)

```bash
cd ai-observability
npm install
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 node agent.js
```

## Why this matters for a migration

- **Cost attribution:** `gen_ai.usage.*` tokens per trace become a dashboard,
  the same way you'd track an LLM provider bill.
- **Latency SLOs:** model latency and tool latency are separate spans, so you
  can alert on each independently.
- **One backend:** prompts, completions, infra logs and traces live together —
  no separate "LLM observability" tool to buy.
- **Vendor-neutral:** it's plain OTLP, so it moves with everything else if you
  change backends.

## Notes & cautions

- Prompts/completions can contain PII. Treat the stream as sensitive and use
  OpenObserve's retention/roles accordingly.
- The conventions are marked experimental; attribute names may evolve. Pin your
  SDK and revisit when the spec stabilizes.

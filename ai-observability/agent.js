'use strict';

/**
 * Minimal LLM-agent demo that emits OpenTelemetry `gen_ai.*` spans.
 *
 * It simulates an agent loop (plan -> call model -> call a tool -> answer) and
 * exports spans over OTLP/HTTP to the collector, so they land in OpenObserve
 * next to your logs and metrics.
 *
 * No API key and no real model call: tokens and latency are synthesized. Swap
 * the `callModel()` body for your real SDK call and the span shape is identical.
 *
 * Span/attribute names follow the OTel GenAI semantic conventions:
 *   https://opentelemetry.io/docs/specs/semconv/gen-ai/
 */

const { trace, SpanStatusCode } = require('@opentelemetry/api');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const {
  OTLPTraceExporter,
} = require('@opentelemetry/exporter-trace-otlp-proto');

const MODEL = process.env.GENAI_MODEL || 'gpt-4o-mini';
const ITERATIONS = parseInt(process.env.AGENT_ITERATIONS || '5', 10);

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': process.env.OTEL_SERVICE_NAME || 'ai-agent-demo',
    'service.namespace': 'openobserve-migration-accelerator',
    'gen_ai.system': 'openai',
  }),
  traceExporter: new OTLPTraceExporter(),
});
sdk.start();

const tracer = trace.getTracer('ai-agent-demo', '1.0.0');

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Simulated model call. Replace with your provider SDK; keep the attributes.
async function callModel(span, prompt) {
  const inputTokens = Math.round(rand(80, 400));
  const outputTokens = Math.round(rand(20, 220));
  const latency = rand(300, 1400);
  await sleep(latency);

  span.setAttributes({
    'gen_ai.operation.name': 'chat',
    'gen_ai.system': 'openai',
    'gen_ai.request.model': MODEL,
    'gen_ai.request.temperature': 0.2,
    'gen_ai.response.model': MODEL,
    'gen_ai.response.finish_reasons': ['stop'],
    'gen_ai.usage.input_tokens': inputTokens,
    'gen_ai.usage.output_tokens': outputTokens,
  });
  // Prompts/responses belong in events, not attributes, per the conventions.
  span.addEvent('gen_ai.content.prompt', { 'gen_ai.prompt': prompt.slice(0, 120) });
  span.addEvent('gen_ai.content.completion', {
    'gen_ai.completion': `[simulated ${outputTokens}-token answer]`,
  });
  return { inputTokens, outputTokens };
}

async function runAgent(task) {
  // One root span per agent invocation.
  return tracer.startActiveSpan('invoke_agent', async (root) => {
    root.setAttribute('gen_ai.operation.name', 'invoke_agent');
    root.setAttribute('gen_ai.agent.name', 'demo-agent');
    root.setAttribute('agent.task', task);
    let totalIn = 0;
    let totalOut = 0;

    try {
      for (let i = 0; i < ITERATIONS; i++) {
        // Model call child span, named per the conventions.
        await tracer.startActiveSpan(`chat ${MODEL}`, async (chat) => {
          const usage = await callModel(chat, `step ${i + 1}: ${task}`);
          totalIn += usage.inputTokens;
          totalOut += usage.outputTokens;
          chat.end();
        });

        // Occasionally simulate a tool call (e.g. a retrieval step).
        if (Math.random() < 0.5) {
          await tracer.startActiveSpan('execute_tool search_docs', async (tool) => {
            tool.setAttributes({
              'gen_ai.operation.name': 'execute_tool',
              'gen_ai.tool.name': 'search_docs',
              'gen_ai.tool.call.id': `call_${Math.random().toString(36).slice(2, 10)}`,
            });
            await sleep(rand(50, 300));
            tool.end();
          });
        }
      }

      root.setAttributes({
        'gen_ai.usage.input_tokens': totalIn,
        'gen_ai.usage.output_tokens': totalOut,
      });
      root.setStatus({ code: SpanStatusCode.OK });
    } catch (err) {
      root.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    } finally {
      root.end();
    }
  });
}

(async () => {
  const task = process.env.AGENT_TASK || 'Summarize recent errors in checkout-api';
  console.log(`[ai-agent] running agent for task: ${task}`);
  await runAgent(task);
  console.log('[ai-agent] done; flushing spans…');
  await sdk.shutdown();
  console.log('[ai-agent] flushed. Look for stream "ai-agent-demo" in OpenObserve → Traces.');
})().catch((err) => {
  console.error('agent failed', err);
  process.exit(1);
});

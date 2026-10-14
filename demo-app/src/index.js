'use strict';

// IMPORTANT: load the OTel SDK before express/http so auto-instrumentation can
// patch those modules. Do not reorder these two lines.
require('./otel');

const express = require('express');
const { metrics, trace } = require('@opentelemetry/api');
const log = require('./logger');

const ROLE = process.env.SERVICE_ROLE || 'checkout';
const PORT = parseInt(process.env.PORT || (ROLE === 'orders' ? '8081' : '8080'), 10);
const DOWNSTREAM_URL = process.env.DOWNSTREAM_URL || '';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'demo-app';

// ---------------------------------------------------------------------------
// Custom application metrics (auto-instrumentation covers HTTP metrics; these
// show how to emit business-level metrics that a migration can map 1:1 onto
// Datadog custom metrics / Splunk metrics indexes).
// ---------------------------------------------------------------------------
const meter = metrics.getMeter('demo-app', '1.0.0');
const requestCounter = meter.createCounter('demo.requests.total', {
  description: 'Total number of application requests handled',
});
const errorCounter = meter.createCounter('demo.orders.failed', {
  description: 'Number of orders that failed processing',
});
const requestLatency = meter.createHistogram('demo.request.duration', {
  description: 'Application handler latency',
  unit: 'ms',
});

const tracer = trace.getTracer('demo-app', '1.0.0');

// ---------------------------------------------------------------------------
// Synthetic workload knobs. Kept deliberately small but non-trivial so the
// dashboards show realistic error rates and a visible p95.
// ---------------------------------------------------------------------------
const ERROR_RATE = parseFloat(process.env.DEMO_ERROR_RATE || '0.05');
const SLOW_RATE = parseFloat(process.env.DEMO_SLOW_RATE || '0.08');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function simulateWork(spanName) {
  // Create an explicit child span for the "business logic" so the trace has
  // depth beyond the HTTP server span.
  return tracer.startActiveSpan(spanName, async (span) => {
    const slow = Math.random() < SLOW_RATE;
    const ms = slow ? 150 + Math.random() * 400 : 5 + Math.random() * 25;
    span.setAttribute('demo.slow', slow);
    span.setAttribute('demo.processing_ms', Math.round(ms));
    await sleep(ms);
    span.end();
    return ms;
  });
}

const app = express();
app.use(express.json());

// Liveness/readiness probe. Never instrumented in a way that masks failures.
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME, role: ROLE });
});

app.get('/', (_req, res) => {
  res.json({
    service: SERVICE_NAME,
    role: ROLE,
    endpoints: ROLE === 'checkout' ? ['/checkout', '/healthz'] : ['/orders/:id', '/healthz'],
  });
});

// ---------------------------------------------------------------------------
// orders-api: the downstream service.
// ---------------------------------------------------------------------------
app.get('/orders/:id', async (req, res) => {
  const start = Date.now();
  const orderId = req.params.id;
  const span = trace.getActiveSpan();
  span?.setAttribute('order.id', orderId);

  try {
    const ms = await simulateWork('orders.process');

    if (Math.random() < ERROR_RATE) {
      errorCounter.add(1, { service: SERVICE_NAME, reason: 'inventory_unavailable' });
      log.error('order processing failed', { order_id: orderId, reason: 'inventory_unavailable' });
      return res.status(500).json({ error: 'inventory_unavailable', order_id: orderId });
    }

    log.info('order processed', { order_id: orderId, processing_ms: Math.round(ms) });
    return res.json({ order_id: orderId, status: 'confirmed', processing_ms: Math.round(ms) });
  } finally {
    requestLatency.record(Date.now() - start, { service: SERVICE_NAME, route: '/orders/:id' });
    requestCounter.add(1, {
      service: SERVICE_NAME,
      route: '/orders/:id',
      status_code: res.statusCode,
    });
  }
});

// ---------------------------------------------------------------------------
// checkout-api: the public entry point that fans out to orders-api.
// ---------------------------------------------------------------------------
app.get('/checkout', async (req, res) => {
  const start = Date.now();
  const orderId = 'ord-' + Math.floor(Math.random() * 1000000);
  const span = trace.getActiveSpan();
  span?.setAttribute('order.id', orderId);

  try {
    const ms = await simulateWork('checkout.validate_cart');

    const url = `${DOWNSTREAM_URL}/orders/${orderId}`;
    const downstream = await fetch(url);
    const body = await downstream.json().catch(() => ({}));

    if (!downstream.ok) {
      log.warn('checkout rejected by downstream', {
        order_id: orderId,
        downstream_status: downstream.status,
      });
      return res.status(502).json({ error: 'downstream_error', order_id: orderId, downstream: body });
    }

    log.info('checkout complete', {
      order_id: orderId,
      cart_size: 1 + Math.floor(Math.random() * 4),
      total_ms: Math.round(ms),
    });
    return res.json({ order_id: orderId, status: 'ok', downstream: body });
  } catch (err) {
    log.error('checkout failed', { order_id: orderId, error: err.message });
    return res.status(500).json({ error: 'checkout_failed', order_id: orderId });
  } finally {
    requestLatency.record(Date.now() - start, { service: SERVICE_NAME, route: '/checkout' });
    requestCounter.add(1, {
      service: SERVICE_NAME,
      route: '/checkout',
      status_code: res.statusCode,
    });
  }
});

const server = app.listen(PORT, () => {
  log.info('service listening', { port: PORT, role: ROLE, service: SERVICE_NAME });
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());

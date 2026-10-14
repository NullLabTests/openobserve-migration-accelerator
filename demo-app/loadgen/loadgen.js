'use strict';

/**
 * Zero-dependency load generator.
 *
 * Fires a configurable number of requests per second at the checkout API so
 * that OpenObserve has fresh logs, metrics and traces within seconds of
 * `docker compose up`. Uses the global fetch available in Node 20+.
 */

const TARGET_URL = (process.env.TARGET_URL || 'http://localhost:8080').replace(/\/$/, '');
const RPS = Math.max(1, parseInt(process.env.LOADGEN_RPS || '20', 10));
const INTERVAL_MS = Math.round(1000 / RPS);

let sent = 0;
let failed = 0;

async function fire() {
  const url = `${TARGET_URL}/checkout`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    // Drain the body so the connection can be reused.
    await res.text();
    sent += 1;
    if (!res.ok) failed += 1;
  } catch (_err) {
    failed += 1;
  }

  if (sent % 50 === 0) {
    const errRate = sent ? ((failed / sent) * 100).toFixed(1) : '0.0';
    process.stdout.write(`[loadgen] sent=${sent} non-2xx/errors=${failed} (${errRate}%)\n`);
  }
}

process.stdout.write(`[loadgen] driving ${RPS} req/s at ${TARGET_URL}/checkout\n`);
setInterval(fire, INTERVAL_MS);

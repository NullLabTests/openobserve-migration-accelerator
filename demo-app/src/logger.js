'use strict';

/**
 * Tiny structured logger that emits OpenTelemetry log records via the Logs API.
 *
 * Because we emit from inside an active span, the SDK automatically attaches
 * trace_id / span_id to each record, which is what lets OpenObserve correlate
 * a log line straight back to the trace that produced it.
 *
 * Everything is also written to stdout so `docker compose logs -f checkout-api`
 * stays useful for humans.
 */

const { logs, SeverityNumber } = require('@opentelemetry/api-logs');

const logger = logs.getLogger('demo-app', '1.0.0');

const LEVELS = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

const CONFIGURED_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const ORDER = { debug: 10, info: 20, warn: 30, error: 40 };

function emit(level, message, attributes = {}) {
  if (ORDER[level] < (ORDER[CONFIGURED_LEVEL] || ORDER.info)) {
    return;
  }
  logger.emit({
    severityNumber: LEVELS[level],
    severityText: level.toUpperCase(),
    body: message,
    attributes,
  });
  const line = JSON.stringify({ level, message, ...attributes });
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

module.exports = {
  debug: (msg, attrs) => emit('debug', msg, attrs),
  info: (msg, attrs) => emit('info', msg, attrs),
  warn: (msg, attrs) => emit('warn', msg, attrs),
  error: (msg, attrs) => emit('error', msg, attrs),
};

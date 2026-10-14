'use strict';

/**
 * OpenTelemetry bootstrap for the demo app.
 *
 * This module wires the OpenTelemetry Node SDK to export traces, metrics and
 * logs over OTLP/HTTP to whatever endpoint `OTEL_EXPORTER_OTLP_ENDPOINT`
 * points at (the collector, in the compose stack). It must be required BEFORE
 * express so the auto-instrumentations can patch the libraries on load.
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-proto');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-proto');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');

const serviceName = process.env.OTEL_SERVICE_NAME || 'demo-app';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': serviceName,
    'service.namespace': 'openobserve-migration-accelerator',
    'service.version': process.env.SERVICE_VERSION || '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter(),
  metricReaders: [
    new PeriodicExportingMetricReader({
      exportIntervalMillis: 10000,
      exporter: new OTLPMetricExporter(),
    }),
  ],
  logRecordProcessors: [
    new BatchLogRecordProcessor({
      exporter: new OTLPLogExporter(),
      scheduledDelayMillis: 2000,
    }),
  ],
  instrumentations: [
    getNodeAutoInstrumentations({
      // Filesystem instrumentation is extremely noisy for a demo.
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

// Flush telemetry on shutdown so a `docker compose stop` does not lose data.
const shutdown = () => {
  sdk
    .shutdown()
    .catch((err) => console.error('Error shutting down OpenTelemetry SDK', err))
    .finally(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log(`[otel] OpenTelemetry SDK started for service "${serviceName}"`);

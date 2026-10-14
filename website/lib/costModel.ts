/**
 * Cost model for the OpenObserve Migration Accelerator web calculator.
 *
 * This mirrors `cost-estimator/openobserve_cost/model.py` exactly. Keep the two
 * in sync when changing assumptions.
 *
 * OpenObserve stores Parquet on object storage with adaptive zstd compression,
 * so the per-GB cost is a fraction of a hot search-index vendor. All values are
 * USD and intentionally conservative ballparks.
 */

export const PRICEBOOK = {
  openobserve: {
    compressionRatio: 0.1, // 0.10 == 10x compression (conservative)
    storageUsdPerGbMonth: 0.023, // S3 Standard list
    computeNodes: 1,
    computeUsdPerNodeMonth: 60,
  },
  providers: {
    datadog: 3.0, // $/GB/day/month; ingest-only floor ($0.10/GB * 30d)
    splunk: 12.5, // ~$150/GB/day annual list / 12
    elastic: 1.5, // blended hot-tier estimate
  },
  daysPerMonth: 30,
} as const;

export type ProviderKey = "datadog" | "splunk" | "elastic";

export interface CostInputs {
  dailyIngestGb: number;
  retentionDays: number;
  compressionRatio: number;
  storageUsdPerGbMonth: number;
  computeNodes: number;
  computeUsdPerNodeMonth: number;
  currentSpendMonthly?: number | null;
  source?: ProviderKey | "custom" | null;
  sourceUsdPerGbDay?: number | null;
}

export interface CostEstimate {
  dailyIngestGb: number;
  retentionDays: number;
  monthlyRawGb: number;
  retainedRawGb: number;
  retainedStoredGb: number;
  compressionRatio: number;
  storageCostMonthly: number;
  computeCostMonthly: number;
  openobserveMonthly: number;
  openobserveAnnual: number;
  currentSource: string;
  currentMonthly: number | null;
  monthlySavings: number | null;
  annualSavings: number | null;
  savingsPct: number | null;
  reductionFactor: number | null;
}

export function defaultInputs(): CostInputs {
  return {
    dailyIngestGb: 100,
    retentionDays: 30,
    compressionRatio: PRICEBOOK.openobserve.compressionRatio,
    storageUsdPerGbMonth: PRICEBOOK.openobserve.storageUsdPerGbMonth,
    computeNodes: PRICEBOOK.openobserve.computeNodes,
    computeUsdPerNodeMonth: PRICEBOOK.openobserve.computeUsdPerNodeMonth,
    currentSpendMonthly: null,
    source: "datadog",
    sourceUsdPerGbDay: null,
  };
}

function resolveCurrentMonthly(inputs: CostInputs): {
  source: string;
  currentMonthly: number | null;
} {
  if (
    inputs.currentSpendMonthly !== null &&
    inputs.currentSpendMonthly !== undefined &&
    Number.isFinite(inputs.currentSpendMonthly) &&
    inputs.currentSpendMonthly >= 0
  ) {
    return {
      source: inputs.source ?? "custom",
      currentMonthly: inputs.currentSpendMonthly,
    };
  }

  if (inputs.source && inputs.source in PRICEBOOK.providers) {
    const key = inputs.source as ProviderKey;
    const rate = inputs.sourceUsdPerGbDay ?? PRICEBOOK.providers[key];
    return {
      source: key,
      currentMonthly:
        inputs.dailyIngestGb * rate * PRICEBOOK.daysPerMonth,
    };
  }

  return { source: "none", currentMonthly: null };
}

export function estimate(inputs: CostInputs): CostEstimate {
  const days = PRICEBOOK.daysPerMonth;
  const monthlyRawGb = inputs.dailyIngestGb * days;
  const retainedRawGb = inputs.dailyIngestGb * inputs.retentionDays;
  const retainedStoredGb = retainedRawGb * inputs.compressionRatio;

  const storageCostMonthly =
    retainedStoredGb * inputs.storageUsdPerGbMonth;
  const computeCostMonthly =
    inputs.computeNodes * inputs.computeUsdPerNodeMonth;
  const openobserveMonthly = storageCostMonthly + computeCostMonthly;

  const { source, currentMonthly } = resolveCurrentMonthly(inputs);

  let monthlySavings: number | null = null;
  let annualSavings: number | null = null;
  let savingsPct: number | null = null;
  let reductionFactor: number | null = null;

  if (currentMonthly !== null) {
    monthlySavings = currentMonthly - openobserveMonthly;
    annualSavings = monthlySavings * 12;
    if (currentMonthly > 0) {
      savingsPct = (monthlySavings / currentMonthly) * 100;
    }
    if (openobserveMonthly > 0) {
      reductionFactor = currentMonthly / openobserveMonthly;
    }
  }

  return {
    dailyIngestGb: inputs.dailyIngestGb,
    retentionDays: inputs.retentionDays,
    monthlyRawGb,
    retainedRawGb,
    retainedStoredGb,
    compressionRatio: inputs.compressionRatio,
    storageCostMonthly,
    computeCostMonthly,
    openobserveMonthly,
    openobserveAnnual: openobserveMonthly * 12,
    currentSource: source,
    currentMonthly,
    monthlySavings,
    annualSavings,
    savingsPct,
    reductionFactor,
  };
}

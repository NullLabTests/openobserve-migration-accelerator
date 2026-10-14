/** Small formatting helpers shared by the calculator UI. */

export function usd(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 10_000) {
    return `$${Math.round(value / 1000).toLocaleString()}k`;
  }
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function usdExact(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function gb(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString(undefined, {
      maximumFractionDigits: 1,
    })} TB`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} GB`;
}

export function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toFixed(digits)}%`;
}

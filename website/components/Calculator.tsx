"use client";

import { useMemo, useState } from "react";
import {
  PRICEBOOK,
  estimate,
  type CostInputs,
  type ProviderKey,
} from "@/lib/costModel";
import { gb, pct, usd, usdExact } from "@/lib/format";
import { useCountUp } from "./useCountUp";
import { BoltIcon, CheckIcon, CloudIcon, DatabaseIcon } from "./Icons";

type ProviderOption = ProviderKey | "custom";

const PROVIDERS: { key: ProviderOption; label: string; blurb: string }[] = [
  { key: "datadog", label: "Datadog", blurb: "$0.10/GB ingest + indexing" },
  { key: "splunk", label: "Splunk", blurb: "~$150/GB/day list" },
  { key: "elastic", label: "Elastic", blurb: "blended hot tier" },
  { key: "custom", label: "Custom", blurb: "use your real bill" },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-slate-200">{label}</label>
        {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      className="w-full"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  );
}

function NumberBox({
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-ink-900/70 px-3 py-2 focus-within:border-brand-cyan/60">
      {prefix ? <span className="text-sm text-slate-500">{prefix}</span> : null}
      <input
        type="number"
        className="w-full bg-transparent text-sm text-slate-100 outline-none"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {suffix ? <span className="text-sm text-slate-500">{suffix}</span> : null}
    </div>
  );
}

export default function Calculator() {
  const [dailyGb, setDailyGb] = useState(250);
  const [retentionDays, setRetentionDays] = useState(30);
  const [compressionRatio, setCompressionRatio] = useState<number>(
    PRICEBOOK.openobserve.compressionRatio,
  );
  const [storagePrice, setStoragePrice] = useState<number>(
    PRICEBOOK.openobserve.storageUsdPerGbMonth,
  );
  const [computeNodes, setComputeNodes] = useState<number>(
    PRICEBOOK.openobserve.computeNodes,
  );
  const [provider, setProvider] = useState<ProviderOption>("datadog");
  const [currentSpend, setCurrentSpend] = useState(18000);

  const inputs: CostInputs = useMemo(
    () => ({
      dailyIngestGb: Number.isFinite(dailyGb) ? dailyGb : 0,
      retentionDays: Number.isFinite(retentionDays) ? retentionDays : 0,
      compressionRatio,
      storageUsdPerGbMonth: storagePrice,
      computeNodes: Number.isFinite(computeNodes) ? computeNodes : 0,
      computeUsdPerNodeMonth: PRICEBOOK.openobserve.computeUsdPerNodeMonth,
      currentSpendMonthly: provider === "custom" ? currentSpend : null,
      source: provider === "custom" ? null : provider,
      sourceUsdPerGbDay: null,
    }),
    [dailyGb, retentionDays, compressionRatio, storagePrice, computeNodes, provider, currentSpend],
  );

  const result = useMemo(() => estimate(inputs), [inputs]);

  const annualSavings = result.annualSavings ?? 0;
  const monthlySavings = result.monthlySavings ?? 0;
  const animAnnual = useCountUp(annualSavings);
  const animMonthly = useCountUp(monthlySavings);

  const compressionX = (1 / compressionRatio).toFixed(0);
  const maxBar = Math.max(result.currentMonthly ?? 0, result.openobserveMonthly, 1);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ---------------------------------------------------------------- */}
      {/* Inputs                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="glass ring-gradient rounded-2xl p-6 sm:p-7">
        <h2 className="text-lg font-semibold text-white">Your telemetry</h2>
        <p className="mt-1 mb-6 text-sm text-slate-400">
          Move the sliders. Everything recalculates instantly.
        </p>

        <div className="space-y-6">
          <Field label="Daily ingest (raw)" hint={`${gb(result.monthlyRawGb)}/month`}>
            <div className="grid grid-cols-[1fr_7rem] items-center gap-4">
              <Slider value={dailyGb} min={1} max={2000} step={1} onChange={setDailyGb} />
              <NumberBox value={dailyGb} onChange={setDailyGb} min={0} suffix="GB/d" />
            </div>
          </Field>

          <Field label="Retention" hint={`${gb(result.retainedStoredGb)} stored`}>
            <div className="grid grid-cols-[1fr_7rem] items-center gap-4">
              <Slider
                value={retentionDays}
                min={1}
                max={365}
                step={1}
                onChange={setRetentionDays}
              />
              <NumberBox value={retentionDays} onChange={setRetentionDays} min={0} suffix="days" />
            </div>
          </Field>

          <Field label="Compression" hint={`${compressionX}x`}>
            <Slider
              value={compressionRatio}
              min={0.05}
              max={0.4}
              step={0.01}
              onChange={setCompressionRatio}
            />
            <p className="mt-2 text-xs text-slate-500">
              Parquet + zstd on object storage. 10x is conservative; JSON logs often hit 15–20x.
            </p>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Object storage" hint="$/GB/mo">
              <NumberBox value={storagePrice} onChange={setStoragePrice} min={0} step={0.001} prefix="$" />
            </Field>
            <Field label="Compute nodes">
              <NumberBox value={computeNodes} onChange={setComputeNodes} min={0} max={50} step={1} />
            </Field>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-slate-200">
              Compare against
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROVIDERS.map((p) => {
                const active = provider === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setProvider(p.key)}
                    className={
                      "rounded-xl border px-3 py-2.5 text-left transition " +
                      (active
                        ? "border-brand-cyan/60 bg-brand-cyan/10 text-white shadow-glow"
                        : "border-slate-700/60 bg-ink-900/50 text-slate-300 hover:border-slate-500/60")
                    }
                  >
                    <div className="text-sm font-semibold">{p.label}</div>
                    <div className="mt-0.5 text-[11px] leading-tight text-slate-500">
                      {p.blurb}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {provider === "custom" ? (
            <Field label="Current observability spend" hint="monthly, USD">
              <NumberBox value={currentSpend} onChange={setCurrentSpend} min={0} step={100} prefix="$" />
            </Field>
          ) : (
            <p className="rounded-xl border border-slate-700/40 bg-ink-900/40 px-4 py-3 text-xs text-slate-400">
              Estimated current spend of{" "}
              <span className="font-semibold text-slate-200">
                {usdExact(result.currentMonthly)}/mo
              </span>{" "}
              from the {provider} list-rate ballpark. Pick{" "}
              <span className="text-slate-200">Custom</span> to enter your real bill.
            </p>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Results                                                          */}
      {/* ---------------------------------------------------------------- */}
      <div className="space-y-6">
        <div className="glass-strong ring-gradient overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium uppercase tracking-wider text-slate-400">
              Estimated annual savings
            </span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              {result.reductionFactor ? `${result.reductionFactor.toFixed(0)}x cheaper` : "—"}
            </span>
          </div>

          <div className="mt-3 text-5xl font-bold tracking-tight text-white sm:text-6xl">
            {usd(animAnnual)}
          </div>
          <div className="mt-2 text-sm text-slate-400">
            {usdExact(animMonthly)} per month · {pct(result.savingsPct)} lower run-rate
          </div>

          {/* Savings ring */}
          <div className="mt-7 flex flex-col items-center gap-6 sm:flex-row">
            <SavingsRing percent={result.savingsPct ?? 0} />
            <div className="grid flex-1 grid-cols-2 gap-3">
              <MiniStat
                icon={<DatabaseIcon className="h-4 w-4" />}
                label="OpenObserve / mo"
                value={usdExact(result.openobserveMonthly)}
                tone="cyan"
              />
              <MiniStat
                icon={<CloudIcon className="h-4 w-4" />}
                label="Current / mo"
                value={usdExact(result.currentMonthly)}
                tone="slate"
              />
              <MiniStat
                icon={<BoltIcon className="h-4 w-4" />}
                label="Storage / mo"
                value={usdExact(result.storageCostMonthly)}
                tone="violet"
              />
              <MiniStat
                icon={<BoltIcon className="h-4 w-4" />}
                label="Compute / mo"
                value={usdExact(result.computeCostMonthly)}
                tone="violet"
              />
            </div>
          </div>
        </div>

        {/* Comparison bar chart */}
        <div className="glass rounded-2xl p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Monthly run-rate
            </h3>
            <span className="text-xs text-slate-500">USD / month</span>
          </div>
          <Bar
            label={result.currentSource === "none" ? "Current" : capitalize(result.currentSource)}
            value={result.currentMonthly ?? 0}
            max={maxBar}
            color="from-slate-500 to-slate-400"
          />
          <Bar
            label="OpenObserve"
            value={result.openobserveMonthly}
            max={maxBar}
            color="from-brand-cyan to-brand-violet"
            highlight
          />

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-slate-700/40 pt-5 text-sm">
            <Row label="Raw retained" value={gb(result.retainedRawGb)} />
            <Row label="Compressed stored" value={gb(result.retainedStoredGb)} />
            <Row label="Compression" value={`${compressionX}x`} />
            <Row label="Retention" value={`${result.retentionDays} days`} />
          </dl>
        </div>

        <details className="glass group rounded-2xl p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Model assumptions
            </span>
            <span className="text-xs text-slate-500 group-open:hidden">
              show
            </span>
            <span className="hidden text-xs text-slate-500 group-open:inline">
              hide
            </span>
          </summary>
          <div className="mt-4 space-y-2 text-sm text-slate-400">
            <p>
              OpenObserve stores <span className="text-slate-200">Parquet on object storage</span>{" "}
              with adaptive zstd compression. Cost = storage + compute:
            </p>
            <pre className="overflow-x-auto rounded-lg border border-slate-700/40 bg-ink-900/70 p-3 text-xs text-slate-300">
{`stored_gb   = daily_gb × retention_days × compression_ratio
storage_cost = stored_gb × storage_price
compute_cost = nodes × $60
openobserve  = storage_cost + compute_cost`}
            </pre>
            <ul className="list-inside list-disc space-y-1 pt-1">
              <li>Datadog fallback: $3.00/GB/day/mo (ingest-only floor; real bills add indexing).</li>
              <li>Splunk fallback: $12.50/GB/day/mo (~$150/GB/day annual list, heavily discounted).</li>
              <li>Elastic fallback: $1.50/GB/day/mo (blended hot tier).</li>
            </ul>
            <p className="text-xs text-slate-500">
              Ballpark figures for POC planning, not invoices. Replace with your negotiated rates.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "cyan" | "violet" | "slate";
}) {
  const toneClass =
    tone === "cyan"
      ? "text-brand-cyan"
      : tone === "violet"
        ? "text-brand-violet"
        : "text-slate-300";
  return (
    <div className="rounded-xl border border-slate-700/40 bg-ink-900/50 px-3 py-3">
      <div className={"mb-1 flex items-center gap-1.5 " + toneClass}>{icon}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-200">{value}</dd>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  color,
  highlight,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  highlight?: boolean;
}) {
  const pctWidth = Math.max(2, (value / max) * 100);
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className={highlight ? "font-semibold text-white" : "text-slate-300"}>
          {label}
        </span>
        <span className={highlight ? "font-semibold text-white" : "text-slate-400"}>
          {usdExact(value)}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className={
            "h-full rounded-full bg-gradient-to-r transition-all duration-700 " + color
          }
          style={{ width: `${pctWidth}%` }}
        />
      </div>
    </div>
  );
}

function SavingsRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#22d3ee" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{clamped.toFixed(0)}%</span>
        <span className="text-[11px] uppercase tracking-wide text-slate-500">savings</span>
      </div>
    </div>
  );
}

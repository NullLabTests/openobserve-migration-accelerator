import { BoltIcon, CloudIcon, DatabaseIcon, LogoMark } from "./Icons";

function Node({
  title,
  subtitle,
  chips,
  accent,
  icon,
}: {
  title: string;
  subtitle: string;
  chips: string[];
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass relative w-full rounded-2xl p-5 sm:w-56">
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accent}`}>
        {icon}
      </div>
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-0.5 text-xs text-slate-400">{subtitle}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span
            key={c}
            className="rounded-md border border-slate-700/60 bg-ink-900/60 px-2 py-0.5 font-mono text-[10px] text-slate-400"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-2 sm:py-0">
      <span className="mb-1 font-mono text-[10px] text-slate-500">{label}</span>
      <div className="relative h-1 w-12 overflow-hidden rounded-full bg-slate-700/50 sm:w-full">
        <div className="absolute inset-y-0 -left-1/3 w-1/3 animate-[shimmer_1.8s_linear_infinite] rounded-full bg-gradient-to-r from-transparent via-brand-cyan to-transparent" />
      </div>
    </div>
  );
}

export default function Architecture() {
  return (
    <div className="glass-strong rounded-3xl p-6 sm:p-9">
      <div className="mb-7 text-center">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          The stack, end to end
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
          Instrumented microservices emit OTLP; a collector fans it out to
          OpenObserve where it lands as compressed Parquet on object storage.
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-1 lg:flex-row lg:items-center lg:gap-3">
        <Node
          title="Demo microservices"
          subtitle="checkout-api + orders-api, OTel-instrumented"
          chips={["traces", "metrics", "logs"]}
          accent="from-brand-cyan/25 to-brand-cyan/5 text-brand-cyan"
          icon={<CloudIcon className="h-5 w-5" />}
        />
        <Connector label="OTLP 4318/4317" />
        <Node
          title="OTel Collector"
          subtitle="receive, batch, fan-out"
          chips={["otlp", "batch", "retry"]}
          accent="from-brand-violet/25 to-brand-violet/5 text-brand-violet"
          icon={<BoltIcon className="h-5 w-5" />}
        />
        <Connector label="OTLP/HTTP" />
        <Node
          title="OpenObserve"
          subtitle="single binary, disk or object store"
          chips={["parquet", "zstd", "SQL"]}
          accent="from-brand-teal/25 to-brand-teal/5 text-brand-teal"
          icon={<DatabaseIcon className="h-5 w-5" />}
        />
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
        <LogoMark className="h-4 w-4" />
        <span>
          Swap the demo services for your own apps — the collector and backend
          stay identical.
        </span>
      </div>
    </div>
  );
}

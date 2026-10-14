import Calculator from "@/components/Calculator";
import Architecture from "@/components/Architecture";
import {
  ArrowIcon,
  BoltIcon,
  CheckIcon,
  CloudIcon,
  DatabaseIcon,
  GithubIcon,
  LogoMark,
  RocketIcon,
} from "@/components/Icons";

const GITHUB_URL =
  "https://github.com/NullLabTests/openobserve-migration-accelerator";

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-8 w-8" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">
              OpenObserve Cost Calculator
            </div>
            <div className="text-[11px] text-slate-500">Migration Accelerator</div>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <a
            href="#how"
            className="hidden rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:text-white sm:block"
          >
            How it works
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-slate-700/60 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            <GithubIcon className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-5 pt-14 pb-10 sm:pt-20">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-1.5 text-xs font-medium text-brand-cyan">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-cyan opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-cyan" />
          </span>
          Open-source · MIT · runs with one command
        </div>

        <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">
          Cut your observability bill with{" "}
          <span className="text-gradient">OpenObserve</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
          Model your real ingest volume, retention and compression to see what
          you'd pay on OpenObserve — then compare it to Datadog, Splunk or
          Elastic. Same numbers as the bundled CLI.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#calculator"
            className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-violet px-5 py-3 text-sm font-semibold text-ink-950 shadow-glow transition hover:brightness-110"
          >
            Estimate my savings
            <ArrowIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl border border-slate-700/70 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            <RocketIcon className="h-4 w-4" />
            Run the demo stack
          </a>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "10–20x", v: "typical compression" },
            { k: "1 command", v: "docker compose up" },
            { k: "L+M+T", v: "logs, metrics, traces" },
            { k: "OTLP", v: "native, no agents" },
          ].map((s) => (
            <div key={s.k} className="glass rounded-xl px-4 py-3 text-center">
              <div className="text-lg font-bold text-white">{s.k}</div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: <CloudIcon className="h-5 w-5" />,
      title: "Point your telemetry at OTLP",
      body: "Apps send OTLP to a collector; existing Datadog/Splunk/Elastic agents forward through receivers. No rip-and-replace.",
    },
    {
      icon: <DatabaseIcon className="h-5 w-5" />,
      title: "OpenObserve stores Parquet",
      body: "Adaptive zstd compression on cheap object storage. Search stays hot; long retention costs almost nothing.",
    },
    {
      icon: <BoltIcon className="h-5 w-5" />,
      title: "Cut the run-rate, keep the signal",
      body: "Dual-write, validate dashboards and alerts, then cut over. The calculator shows the target bill.",
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-16">
      <div className="mb-10 text-center">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          Why the number moves
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
          It isn't magic — it's the storage architecture. OTel in, Parquet on
          object storage, query on demand.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="glass rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-cyan/20 to-brand-violet/20 text-brand-cyan">
                {s.icon}
              </div>
              <span className="text-xs font-semibold text-slate-500">
                STEP {i + 1}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhatYouGet() {
  const items = [
    "One-command local stack: OpenObserve + OTel Collector + instrumented microservices",
    "Migration runbook and dual-write configs for Datadog, Fluent Bit, Vector and HEC",
    "Importable dashboards and alert rules for service health & volume tracking",
    "AI / LLM observability example emitting gen_ai spans",
    "This calculator as both a CLI (oo-cost) and this web app",
    "MIT licensed, no vendor lock-in, no secrets in the repo",
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20">
      <div className="glass-strong rounded-3xl p-8 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              A complete POC kit, not just a calculator
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              The calculator is one half. The repo ships the full migration
              toolkit so a platform team can stand up a credible POC in an
              afternoon and hand a runbook to stakeholders.
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-brand-cyan/40 bg-brand-cyan/10 px-5 py-3 text-sm font-semibold text-brand-cyan transition hover:bg-brand-cyan/20"
            >
              <GithubIcon className="h-4 w-4" />
              Explore the repo
            </a>
          </div>
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <CheckIcon className="h-3 w-3" />
                </span>
                <span className="text-sm leading-relaxed text-slate-300">{it}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 bg-ink-950/60">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7" />
            <span className="text-sm font-semibold text-white">
              OpenObserve Migration Accelerator
            </span>
          </div>
          <div className="flex items-center gap-5 text-sm text-slate-400">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-white">
              GitHub
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/cost-estimator/README.md`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              CLI docs
            </a>
            <span>MIT License</span>
          </div>
        </div>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-slate-500">
          Estimates use documented, overridable ballpark assumptions and are for
          planning conversations only — not invoices or quotes. Real-world
          savings depend on your negotiated rates, payload mix and migration
          effort. OpenObserve is a trademark of its respective owners; this
          community project is not affiliated with or endorsed by Zinclabs,
          Datadog, Splunk or Elastic.
        </p>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <section id="calculator" className="mx-auto max-w-6xl px-5 pb-16">
          <Calculator />
        </section>
        <section className="mx-auto max-w-6xl px-5 pb-16">
          <Architecture />
        </section>
        <HowItWorks />
        <WhatYouGet />
      </main>
      <Footer />
    </>
  );
}

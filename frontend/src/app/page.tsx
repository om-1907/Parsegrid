import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Sparkles,
  ShieldCheck,
  FileSearch,
  Workflow,
  BarChart3,
  GitCompareArrows,
  Fingerprint,
  Gauge,
  CheckCircle2,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingNav } from "@/components/landing/LandingNav";
import HeroCanvasLazy from "@/components/landing/HeroCanvasLazy";
import { Reveal } from "@/components/landing/Reveal";
import { CountUp } from "@/components/landing/CountUp";

const metrics = [
  { end: 96, suffix: "%", label: "Faster contract turnaround" },
  { end: 70, suffix: "%", label: "Lower processing cost" },
  { end: 2, suffix: "k+", label: "Contracts automated" },
  { end: 99, suffix: ".9%", label: "Extraction uptime" },
];

const features = [
  {
    icon: FileSearch,
    title: "Multi-format ingestion",
    desc: "Drop in PDF, DOCX, TXT, CSV, or HTML. Parsegrid reads them all and normalizes the content before extraction.",
    tint: "from-indigo-500/15 to-indigo-500/5 text-indigo-500",
    span: "md:col-span-2",
  },
  {
    icon: Bot,
    title: "Structured LLM extraction",
    desc: "Gemini-powered, Pydantic-enforced output — party, value, terms, penalties, governing law.",
    tint: "from-cyan-500/15 to-cyan-500/5 text-cyan-500",
    span: "",
  },
  {
    icon: Gauge,
    title: "Confidence scoring",
    desc: "Every field carries a confidence score. Low-confidence results are auto-flagged for human review.",
    tint: "from-amber-500/15 to-amber-500/5 text-amber-500",
    span: "",
  },
  {
    icon: Fingerprint,
    title: "SHA-256 dedup",
    desc: "Identical uploads are detected instantly and never re-processed — saving time and API spend.",
    tint: "from-emerald-500/15 to-emerald-500/5 text-emerald-500",
    span: "",
  },
  {
    icon: ShieldCheck,
    title: "Audit-grade security",
    desc: "JWT sessions over HttpOnly cookies, and every manual override is written to an immutable audit log.",
    tint: "from-violet-500/15 to-violet-500/5 text-violet-500",
    span: "md:col-span-2",
  },
];

const steps = [
  {
    icon: FileSearch,
    title: "Upload",
    desc: "Drag in any contract. We hash, deduplicate, and store it — returning instantly while work runs in the background.",
  },
  {
    icon: Sparkles,
    title: "Extract",
    desc: "The AI pipeline reads the document and returns structured, validated fields with per-field confidence.",
  },
  {
    icon: CheckCircle2,
    title: "Review & act",
    desc: "Low-confidence extractions surface in a review queue. Correct, verify, and export with a full audit trail.",
  },
];

const integrations = ["Salesforce", "Slack", "Google Drive", "Notion", "SharePoint", "DocuSign", "Snowflake", "Zapier"];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingNav />

      {/* ---------------------------------------------------------------- */}
      {/*  Hero                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden">
        <HeroCanvasLazy />
        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-32 text-center sm:px-6">
          <div className="animate-fade-in-up mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            The new era of AI contract intelligence
          </div>
          <h1 className="animate-fade-in-up font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-white md:text-7xl">
            Turn every contract into
            <br className="hidden md:block" />{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-white to-cyan-300 bg-clip-text text-transparent">
              structured intelligence
            </span>
          </h1>
          <p className="animate-fade-in-up mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl">
            Parsegrid ingests any agreement, extracts the fields that matter with confidence-scored
            AI, and routes anything uncertain to a human — so nothing slips through.
          </p>
          <div className="animate-fade-in-up mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login">
              <Button
                size="lg"
                className="h-13 w-full bg-white px-8 text-base font-semibold text-slate-900 shadow-xl shadow-black/20 hover:bg-white/90 sm:w-auto"
              >
                Get started free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#how">
              <Button
                size="lg"
                variant="outline"
                className="h-13 w-full border-white/25 bg-white/5 px-8 text-base font-semibold text-white backdrop-blur hover:bg-white/10 hover:text-white sm:w-auto"
              >
                See how it works
              </Button>
            </Link>
          </div>
          <p className="animate-fade-in-up mt-6 text-sm text-white/40">
            No credit card required · Set up in minutes
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  Trust strip                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-b border-border bg-background py-10">
        <div className="mx-auto max-w-6xl px-4">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Trusted by modern legal & revenue teams
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-60">
            {["Northwind", "Acme Legal", "Vertex", "Lumen", "Contoso", "Ironpeak"].map((name) => (
              <span key={name} className="font-display text-lg font-bold tracking-tight text-foreground/70">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  Metrics                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-background py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-2 gap-y-10 md:grid-cols-4">
            {metrics.map((m, i) => (
              <Reveal key={m.label} delay={i * 80} className="text-center">
                <p className="font-display text-4xl font-bold text-gradient md:text-5xl">
                  <CountUp end={m.end} suffix={m.suffix} />
                </p>
                <p className="mx-auto mt-2 max-w-[12rem] text-sm font-medium text-muted-foreground">
                  {m.label}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  Features (bento)                                                */}
      {/* ---------------------------------------------------------------- */}
      <section id="features" className="border-t border-border bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Everything you need to tame contracts
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              One pipeline: ingest, extract, verify. Built for accuracy, speed, and compliance.
            </p>
          </Reveal>

          <div className="grid gap-5 md:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80} className={f.span}>
                <div className="group h-full rounded-2xl border border-border bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/5 [transform-style:preserve-3d]">
                  <div
                    className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.tint} transition-transform duration-300 group-hover:scale-110`}
                  >
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 font-display text-xl font-bold text-foreground">{f.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  How it works                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section id="how" className="bg-background py-24">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal className="mx-auto mb-16 max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">Workflow</span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              From upload to insight in three steps
            </h2>
          </Reveal>

          <div className="relative grid gap-8 md:grid-cols-3">
            {/* connecting line */}
            <div className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 120}>
                <div className="relative flex flex-col items-center text-center">
                  <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-md">
                    <s.icon className="h-7 w-7 text-primary" />
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mb-2 font-display text-xl font-bold text-foreground">{s.title}</h3>
                  <p className="max-w-xs leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  Agentic AI showcase                                             */}
      {/* ---------------------------------------------------------------- */}
      <section id="ai" className="border-y border-border bg-muted/30 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2">
          <Reveal>
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">Agentic AI</span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              An AI partner that reads the fine print
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Parsegrid doesn&apos;t just OCR your documents — it understands them. Structured
              extraction, confidence scoring, and automatic routing keep humans focused only on what
              actually needs a second look.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                { icon: GitCompareArrows, text: "Side-by-side review with the original document" },
                { icon: BarChart3, text: "Per-field confidence surfaced right in the UI" },
                { icon: Workflow, text: "Auto-flag & route anything below your threshold" },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="font-medium text-foreground">{item.text}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Mock extraction card */}
          <Reveal delay={120}>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-primary/5">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileSearch className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">MSA_Acme_2026.pdf</p>
                    <p className="text-xs text-muted-foreground">Extracted · 5 fields</p>
                  </div>
                </div>
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                  Verified
                </span>
              </div>
              <div className="space-y-4">
                {[
                  { k: "Party name", v: "Acme Industries, Inc.", c: 0.98 },
                  { k: "Contract value", v: "$1,250,000", c: 0.95 },
                  { k: "Payment terms", v: "Net 45", c: 0.88 },
                  { k: "Penalty clause", v: "Yes — §12.3", c: 0.62 },
                  { k: "Governing law", v: "Delaware", c: 0.91 },
                ].map((row) => (
                  <div key={row.k}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{row.k}</span>
                      <span className="font-medium text-foreground">{row.v}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          row.c >= 0.85 ? "bg-success" : row.c >= 0.7 ? "bg-warning" : "bg-destructive"
                        }`}
                        style={{ width: `${Math.round(row.c * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  Integrations                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section id="integrations" className="bg-background py-20">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <Reveal>
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Plugs into the tools you already use
            </h2>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {integrations.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground/80 shadow-sm transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  Testimonial                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-border bg-muted/30 py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <Reveal>
            <Quote className="mx-auto mb-6 h-10 w-10 text-primary/30" />
            <p className="font-display text-2xl font-medium leading-snug text-foreground md:text-3xl">
              “Parsegrid cut our contract review time from days to minutes. The confidence scoring
              means our lawyers only touch what actually needs a human.”
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 font-bold text-white">
                DR
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">Dana Reyes</p>
                <p className="text-sm text-muted-foreground">VP Legal Ops, Northwind</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  Final CTA                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-[#070914] py-28">
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-white md:text-5xl">
            Ready to transform your contracting?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">
            Join the teams building their legal operations on Parsegrid.
          </p>
          <Link href="/login" className="mt-10 inline-block">
            <Button
              size="lg"
              className="h-13 bg-white px-8 text-base font-semibold text-slate-900 shadow-xl hover:bg-white/90"
            >
              Get started for free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  Footer                                                          */}
      {/* ---------------------------------------------------------------- */}
      <footer className="bg-[#050510] py-12 text-white/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400">
              <span className="text-lg font-bold leading-none tracking-tighter text-white">P</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">Parsegrid</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <Link href="#features" className="hover:text-white">Features</Link>
            <Link href="#how" className="hover:text-white">How it works</Link>
            <Link href="#integrations" className="hover:text-white">Integrations</Link>
            <Link href="/login" className="hover:text-white">Sign in</Link>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-white/30">
          © {new Date().getFullYear()} Parsegrid — AI Contract Intelligence. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

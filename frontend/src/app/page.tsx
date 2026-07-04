import Link from "next/link";
import { ParsegridLogo } from "@/components/ParsegridLogo";
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
  Mail,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingNav } from "@/components/landing/LandingNav";
import { FixedVideoBg } from "@/components/landing/FixedVideoBg";
import { VideoHero } from "@/components/landing/VideoHero";
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
    tint: "from-indigo-500/20 to-indigo-500/5 text-indigo-300",
    span: "md:col-span-2",
  },
  {
    icon: Bot,
    title: "Structured LLM extraction",
    desc: "Gemini-powered, Pydantic-enforced output — party, value, terms, penalties, governing law.",
    tint: "from-cyan-500/20 to-cyan-500/5 text-cyan-300",
    span: "",
  },
  {
    icon: Gauge,
    title: "Confidence scoring",
    desc: "Every field carries a confidence score. Low-confidence results are auto-flagged for human review.",
    tint: "from-amber-500/20 to-amber-500/5 text-amber-300",
    span: "",
  },
  {
    icon: Fingerprint,
    title: "SHA-256 dedup",
    desc: "Identical uploads are detected instantly and never re-processed — saving time and API spend.",
    tint: "from-emerald-500/20 to-emerald-500/5 text-emerald-300",
    span: "",
  },
  {
    icon: ShieldCheck,
    title: "Audit-grade security",
    desc: "JWT sessions over HttpOnly cookies, and every manual override is written to an immutable audit log.",
    tint: "from-violet-500/20 to-violet-500/5 text-violet-300",
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

// Shared glass surface for cards/panels laid over the fixed background video.
const GLASS = "rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col text-white">
      {/* Page-wide fixed video background — stays put while everything scrolls over it. */}
      <FixedVideoBg />
      <LandingNav />

      {/* ---------------------------------------------------------------- */}
      {/*  Hero (staggered reveal over the fixed video)                     */}
      {/* ---------------------------------------------------------------- */}
      <VideoHero />

      {/* ---------------------------------------------------------------- */}
      {/*  Trust strip                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative z-10 border-y border-white/10 py-10">
        <div className="mx-auto max-w-6xl px-4">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-white/50">
            Trusted by modern legal &amp; revenue teams
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {["Northwind", "Acme Legal", "Vertex", "Lumen", "Contoso", "Ironpeak"].map((name) => (
              <span key={name} className="font-display text-lg font-bold tracking-tight text-white/55">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  Metrics                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-2 gap-y-10 md:grid-cols-4">
            {metrics.map((m, i) => (
              <Reveal key={m.label} delay={i * 80} className="text-center">
                <p className="font-display text-4xl font-bold text-white md:text-5xl">
                  <CountUp end={m.end} suffix={m.suffix} />
                </p>
                <p className="mx-auto mt-2 max-w-[12rem] text-sm font-medium text-white/65">
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
      <section id="features" className="relative z-10 border-t border-white/10 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              Everything you need to tame contracts
            </h2>
            <p className="mt-4 text-lg text-white/70">
              One pipeline: ingest, extract, verify. Built for accuracy, speed, and compliance.
            </p>
          </Reveal>

          <div className="grid gap-5 md:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80} className={f.span}>
                <div className={`group h-full ${GLASS} p-7 shadow-xl shadow-black/20 transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/[0.1]`}>
                  <div
                    className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.tint} transition-transform duration-300 group-hover:scale-110`}
                  >
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 font-display text-xl font-bold text-white">{f.title}</h3>
                  <p className="leading-relaxed text-white/70">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  How it works                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section id="how" className="relative z-10 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal className="mx-auto mb-16 max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-amber-300">Workflow</span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              From upload to insight in three steps
            </h2>
          </Reveal>

          <div className="relative grid gap-8 md:grid-cols-3">
            {/* connecting line */}
            <div className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-white/25 to-transparent md:block" />
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 120}>
                <div className="relative flex flex-col items-center text-center">
                  <div className={`relative mb-6 flex h-16 w-16 items-center justify-center ${GLASS} shadow-lg shadow-black/30`}>
                    <s.icon className="h-7 w-7 text-indigo-300" />
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-black">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mb-2 font-display text-xl font-bold text-white">{s.title}</h3>
                  <p className="max-w-xs leading-relaxed text-white/70">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  Agentic AI showcase                                             */}
      {/* ---------------------------------------------------------------- */}
      <section id="ai" className="relative z-10 border-y border-white/10 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2">
          <Reveal>
            <span className="text-sm font-semibold uppercase tracking-widest text-amber-300">Agentic AI</span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              An AI partner that reads the fine print
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-white/70">
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
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-indigo-300">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="font-medium text-white">{item.text}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Mock extraction card */}
          <Reveal delay={120}>
            <div className={`${GLASS} p-6 shadow-2xl shadow-black/40`}>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-indigo-300">
                    <FileSearch className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">MSA_Acme_2026.pdf</p>
                    <p className="text-xs text-white/55">Extracted · 5 fields</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
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
                      <span className="text-white/60">{row.k}</span>
                      <span className="font-medium text-white">{row.v}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${
                          row.c >= 0.85 ? "bg-emerald-400" : row.c >= 0.7 ? "bg-amber-400" : "bg-red-400"
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
      <section id="integrations" className="relative z-10 py-20">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <Reveal>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
              Plugs into the tools you already use
            </h2>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {integrations.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-2.5 text-sm font-medium text-white/80 backdrop-blur transition-colors hover:border-white/25 hover:text-white"
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
      <section className="relative z-10 border-t border-white/10 py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <Reveal>
            <Quote className="mx-auto mb-6 h-10 w-10 text-white/25" />
            <p className="font-display text-2xl font-medium leading-snug text-white md:text-3xl">
              &ldquo;Parsegrid cut our contract review time from days to minutes. The confidence scoring
              means our lawyers only touch what actually needs a human.&rdquo;
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-400 font-bold text-white">
                DR
              </div>
              <div className="text-left">
                <p className="font-semibold text-white">Dana Reyes</p>
                <p className="text-sm text-white/60">VP Legal Ops, Northwind</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  Final CTA                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative z-10 overflow-hidden py-28">
        <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-[120px]" />
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
              className="h-13 rounded-full bg-white px-8 text-base font-semibold text-slate-900 shadow-xl shadow-black/30 hover:bg-white/90"
            >
              Get started for free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/*  Footer                                                          */}
      {/* ---------------------------------------------------------------- */}
      <footer className="relative z-10 border-t border-white/10 bg-[#121212]/90 py-6 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-4 sm:flex-row">
          {/* Left — Brand */}
          <div className="flex items-center gap-2.5">
            <ParsegridLogo textClassName="text-white" />
          </div>

          {/* Center — Copyright */}
          <p className="text-center font-sans text-xs tracking-wide text-gray-500">
            © {new Date().getFullYear()} Parsegrid — AI Contract Intelligence.
            <span className="mx-1">Engineered by</span>
            <span className="font-medium text-gray-400">Om Sutariya</span>.
          </p>

          {/* Right — Social Icons */}
          <div className="flex items-center gap-3">
            {/* GitHub */}
            <a
              href="https://github.com/om-1907"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="rounded-lg p-2 text-gray-400 transition-all duration-200 hover:scale-110 hover:bg-white/5 hover:text-white"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>

            {/* LinkedIn */}
            <a
              href="https://www.linkedin.com/in/om-sutariya-647456379"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="rounded-lg p-2 text-gray-400 transition-all duration-200 hover:scale-110 hover:bg-white/5 hover:text-white"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>

            {/* Email */}
            <a
              href="mailto:omsutariya2006@gmail.com"
              aria-label="Email"
              className="rounded-lg p-2 text-gray-400 transition-all duration-200 hover:scale-110 hover:bg-white/5 hover:text-white"
            >
              <Mail className="h-5 w-5" />
            </a>

            {/* Phone */}
            <a
              href="tel:+919825318768"
              aria-label="Phone"
              className="rounded-lg p-2 text-gray-400 transition-all duration-200 hover:scale-110 hover:bg-white/5 hover:text-white"
            >
              <Phone className="h-5 w-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

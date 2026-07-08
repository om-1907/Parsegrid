"use client";

import { FileStack, AlertTriangle, IndianRupee, CalendarClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { type ExtractedData, computeStats, formatCurrency } from "@/lib/contracts";
import { cn } from "@/lib/utils";

interface StatsOverviewProps {
  data: ExtractedData[];
  loading?: boolean;
}

export function StatsOverview({ data, loading }: StatsOverviewProps) {
  const stats = computeStats(data);

  const cards = [
    { label: "Total contracts", value: stats.total.toLocaleString(), icon: FileStack, tint: "text-indigo-500 bg-indigo-500/10" },
    { label: "Needs review", value: stats.needsReview.toLocaleString(), icon: AlertTriangle, tint: "text-amber-500 bg-amber-500/10" },
    { label: "Total value (INR)", value: formatCurrency(stats.totalValue), icon: IndianRupee, tint: "text-emerald-500 bg-emerald-500/10" },
    { label: "Avg. payment terms", value: stats.avgTerms !== null ? `${Math.round(stats.avgTerms)}d` : "—", icon: CalendarClock, tint: "text-cyan-500 bg-cyan-500/10" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
          {cards.map((c) => (
            <StatCard key={c.label} {...c} loading={loading} />
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
          <p className="mb-3 text-sm font-semibold text-foreground">Review status</p>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Skeleton className="h-32 w-32 rounded-full" />
            </div>
          ) : (
            <Donut verified={stats.verified} needsReview={stats.needsReview} />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Contract value distribution">
          {loading ? <BarSkeleton /> : <BarChart data={valueBuckets(data)} emptyLabel="No contract values yet" />}
        </Panel>
        <Panel title="Payment terms mix">
          {loading ? <BarSkeleton /> : <BarChart data={paymentTermsBuckets(data)} emptyLabel="No payment terms yet" />}
        </Panel>
        <Panel title="Penalty clause">
          {loading ? <BarSkeleton /> : <BarChart data={penaltyBreakdown(data)} emptyLabel="No penalty data yet" />}
        </Panel>
      </div>
    </div>
  );
}

/* ─────────────────────────── derived data ─────────────────────────── */

type Bar = { label: string; value: number };

function valueBuckets(rows: ExtractedData[]): Bar[] {
  const buckets = [
    { label: "< ₹1L", test: (v: number) => v < 100_000 },
    { label: "₹1L-10L", test: (v: number) => v >= 100_000 && v < 1_000_000 },
    { label: "₹10L-1Cr", test: (v: number) => v >= 1_000_000 && v < 10_000_000 },
    { label: "₹1Cr+", test: (v: number) => v >= 10_000_000 },
  ];
  return buckets.map((b) => ({
    label: b.label,
    value: rows.filter((r) => typeof r.contract_value === "number" && b.test(r.contract_value as number)).length,
  }));
}

function paymentTermsBuckets(rows: ExtractedData[]): Bar[] {
  const buckets = [
    { label: "Net 0–30", test: (d: number) => d <= 30 },
    { label: "Net 31–60", test: (d: number) => d > 30 && d <= 60 },
    { label: "Net 61–90", test: (d: number) => d > 60 && d <= 90 },
    { label: "Net 90+", test: (d: number) => d > 90 },
  ];
  return buckets.map((b) => ({
    label: b.label,
    value: rows.filter((r) => typeof r.payment_terms_days === "number" && b.test(r.payment_terms_days as number)).length,
  }));
}

function penaltyBreakdown(rows: ExtractedData[]): Bar[] {
  const withClause = rows.filter((r) => r.penalty_clause_exists === true).length;
  const without = rows.filter((r) => r.penalty_clause_exists === false).length;
  return [
    { label: "Has penalty clause", value: withClause },
    { label: "No penalty clause", value: without },
  ];
}

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.1]">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", tint)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">{value}</p>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <p className="mb-4 text-sm font-semibold text-foreground">{title}</p>
      {children}
    </div>
  );
}

function BarChart({ data, emptyLabel = "No data yet" }: { data: Bar[]; emptyLabel?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="truncate text-muted-foreground" title={d.label}>
              {d.label}
            </span>
            <span className="ml-2 shrink-0 font-semibold text-foreground">{d.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function BarSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}

function Donut({ verified, needsReview }: { verified: number; needsReview: number }) {
  const total = verified + needsReview;
  const r = 52;
  const c = 2 * Math.PI * r;
  const verifiedFrac = total > 0 ? verified / total : 0;
  const verifiedLen = c * verifiedFrac;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="14" />
          {total > 0 && (
            <circle
              cx="64"
              cy="64"
              r={r}
              fill="none"
              stroke="hsl(var(--success))"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${verifiedLen} ${c - verifiedLen}`}
              className="transition-[stroke-dasharray] duration-700"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold text-foreground">
            {total > 0 ? Math.round(verifiedFrac * 100) : 0}%
          </span>
          <span className="text-xs text-muted-foreground">verified</span>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-success" />
          <span className="text-muted-foreground">Verified</span>
          <span className="ml-auto font-semibold text-foreground">{verified}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
          <span className="text-muted-foreground">Needs review</span>
          <span className="ml-auto font-semibold text-foreground">{needsReview}</span>
        </div>
      </div>
    </div>
  );
}

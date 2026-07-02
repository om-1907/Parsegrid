"use client";

import { FileStack, AlertTriangle, DollarSign, CalendarClock } from "lucide-react";
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
    { label: "Total value", value: formatCurrency(stats.totalValue), icon: DollarSign, tint: "text-emerald-500 bg-emerald-500/10" },
    { label: "Avg. payment terms", value: stats.avgTerms !== null ? `${Math.round(stats.avgTerms)}d` : "—", icon: CalendarClock, tint: "text-cyan-500 bg-cyan-500/10" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} loading={loading} />
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
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
  );
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
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
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

"use client";

import { Users, AlertTriangle, BadgeCheck, Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { type ExtractedResume, computeResumeStats } from "@/lib/resumes";
import { cn } from "@/lib/utils";

interface ResumeStatsOverviewProps {
  data: ExtractedResume[];
  loading?: boolean;
}

export function ResumeStatsOverview({ data, loading }: ResumeStatsOverviewProps) {
  const stats = computeResumeStats(data);

  const cards = [
    { label: "Total resumes", value: stats.total.toLocaleString(), icon: Users, tint: "text-indigo-500 bg-indigo-500/10" },
    { label: "Left to review", value: stats.needsReview.toLocaleString(), icon: AlertTriangle, tint: "text-amber-500 bg-amber-500/10" },
    { label: "Reviewed", value: stats.verified.toLocaleString(), icon: BadgeCheck, tint: "text-emerald-500 bg-emerald-500/10" },
    {
      label: "Avg. experience",
      value: stats.avgExperience !== null ? `${stats.avgExperience.toFixed(1)} yrs` : "—",
      icon: Briefcase,
      tint: "text-cyan-500 bg-cyan-500/10",
    },
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
            <Donut reviewed={stats.verified} needsReview={stats.needsReview} />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Experience distribution">
          {loading ? <BarSkeleton /> : <BarChart data={experienceBuckets(data)} />}
        </Panel>
        <Panel title="Top skills">
          {loading ? <BarSkeleton /> : <BarChart data={topSkills(data)} emptyLabel="No skills extracted yet" />}
        </Panel>
        <Panel title="Education level">
          {loading ? <BarSkeleton /> : <BarChart data={educationBreakdown(data)} emptyLabel="No education data yet" />}
        </Panel>
      </div>
    </div>
  );
}

/* ─────────────────────────── derived data ─────────────────────────── */

type Bar = { label: string; value: number };

function experienceBuckets(rows: ExtractedResume[]): Bar[] {
  const buckets = [
    { label: "Junior (0–2y)", test: (y: number) => y <= 2 },
    { label: "Mid (3–5y)", test: (y: number) => y >= 3 && y <= 5 },
    { label: "Senior (6–10y)", test: (y: number) => y >= 6 && y <= 10 },
    { label: "Lead (10y+)", test: (y: number) => y > 10 },
  ];
  return buckets.map((b) => ({
    label: b.label,
    value: rows.filter((r) => typeof r.years_of_experience === "number" && b.test(r.years_of_experience as number)).length,
  }));
}

function topSkills(rows: ExtractedResume[], limit = 5): Bar[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const skill of r.skills ?? []) {
      const key = skill.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

function educationBreakdown(rows: ExtractedResume[]): Bar[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const level = normalizeEducation(r.education_level);
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  const order = ["PhD", "Master's", "Bachelor's", "Other"];
  return [...counts.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([label, value]) => ({ label, value }));
}

function normalizeEducation(level: string | null): string {
  if (!level) return "Other";
  const l = level.toLowerCase();
  if (l.includes("phd") || l.includes("doctor")) return "PhD";
  if (l.includes("master") || l.includes("mba") || l.includes("m.s") || l.includes("msc")) return "Master's";
  if (l.includes("bachelor") || l.includes("b.s") || l.includes("bsc") || l.includes("b.a") || l.includes("undergrad")) return "Bachelor's";
  return "Other";
}

/* ─────────────────────────── presentational ─────────────────────────── */

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

function Donut({ reviewed, needsReview }: { reviewed: number; needsReview: number }) {
  const total = reviewed + needsReview;
  const r = 52;
  const c = 2 * Math.PI * r;
  const reviewedFrac = total > 0 ? reviewed / total : 0;
  const reviewedLen = c * reviewedFrac;

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
              strokeDasharray={`${reviewedLen} ${c - reviewedLen}`}
              className="transition-[stroke-dasharray] duration-700"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold text-foreground">
            {total > 0 ? Math.round(reviewedFrac * 100) : 0}%
          </span>
          <span className="text-xs text-muted-foreground">reviewed</span>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-success" />
          <span className="text-muted-foreground">Reviewed</span>
          <span className="ml-auto font-semibold text-foreground">{reviewed}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
          <span className="text-muted-foreground">Left to review</span>
          <span className="ml-auto font-semibold text-foreground">{needsReview}</span>
        </div>
      </div>
    </div>
  );
}

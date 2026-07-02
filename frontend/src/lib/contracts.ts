// Shared types + helpers for extracted contract data.

/** Optional per-field confidence (0..1). Backend persistence is on the roadmap;
 *  the UI degrades gracefully when this is absent. */
export type ConfidenceMap = Partial<
  Record<
    "party_name" | "contract_value" | "payment_terms_days" | "penalty_clause_exists" | "governing_law",
    number
  >
>;

export interface ExtractedData {
  id: string;
  document_id: string;
  party_name: string | null;
  contract_value: number | null;
  payment_terms_days: number | null;
  penalty_clause_exists: boolean | null;
  governing_law: string | null;
  needs_review: boolean;
  filename?: string;
  upload_time?: string;
  confidence?: ConfidenceMap;
}

export interface ContractStats {
  total: number;
  needsReview: number;
  verified: number;
  totalValue: number;
  avgTerms: number | null;
  reviewRate: number; // 0..1
}

export function computeStats(rows: ExtractedData[]): ContractStats {
  const total = rows.length;
  const needsReview = rows.filter((r) => r.needs_review).length;
  const totalValue = rows.reduce((sum, r) => sum + (r.contract_value ?? 0), 0);
  const termRows = rows.filter((r) => typeof r.payment_terms_days === "number");
  const avgTerms =
    termRows.length > 0
      ? termRows.reduce((s, r) => s + (r.payment_terms_days ?? 0), 0) / termRows.length
      : null;

  return {
    total,
    needsReview,
    verified: total - needsReview,
    totalValue,
    avgTerms,
    reviewRate: total > 0 ? needsReview / total : 0,
  };
}

/** Compact currency formatting: $1.25M, $980K, $1,200. */
export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

/** Confidence → semantic tier used for coloring. */
export function confidenceTier(c: number): "high" | "medium" | "low" {
  if (c >= 0.85) return "high";
  if (c >= 0.7) return "medium";
  return "low";
}

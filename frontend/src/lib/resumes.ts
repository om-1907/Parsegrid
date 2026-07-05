export type ResumeConfidenceMap = Partial<
  Record<
    "candidate_name" | "years_of_experience" | "education_level" | "skills" | "previous_companies",
    number
  >
>;

export interface ExtractedResume {
  id: string;
  document_id: string;
  candidate_name: string | null;
  candidate_name_source_quote?: string | null;
  years_of_experience: number | null;
  years_of_experience_source_quote?: string | null;
  education_level: string | null;
  education_level_source_quote?: string | null;
  skills: string[];
  skills_source_quote?: string | null;
  previous_companies: string[];
  previous_companies_source_quote?: string | null;
  needs_review: boolean;
  filename?: string;
  upload_time?: string;
  confidence?: ResumeConfidenceMap;
}

export interface ResumeStats {
  total: number;
  needsReview: number;
  verified: number;
  avgExperience: number | null;
  reviewRate: number;
}

export function computeResumeStats(rows: ExtractedResume[]): ResumeStats {
  const total = rows.length;
  const needsReview = rows.filter((r) => r.needs_review).length;
  const expRows = rows.filter((r) => typeof r.years_of_experience === "number" && r.years_of_experience !== null);
  const avgExperience =
    expRows.length > 0
      ? expRows.reduce((s, r) => s + (r.years_of_experience ?? 0), 0) / expRows.length
      : null;

  return {
    total,
    needsReview,
    verified: total - needsReview,
    avgExperience,
    reviewRate: total > 0 ? needsReview / total : 0,
  };
}

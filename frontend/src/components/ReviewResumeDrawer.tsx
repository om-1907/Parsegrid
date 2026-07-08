"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, FileText, Calendar } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { type ExtractedResume, type ResumeConfidenceMap } from "@/lib/resumes";
import { confidenceTier } from "@/lib/contracts";
import DOMPurify from "dompurify";

interface ReviewResumeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExtractedResume | null;
  onSaved: () => void;
}

type ConfidenceField = keyof ResumeConfidenceMap;

function FieldConfidence({ value }: { value?: number }) {
  if (typeof value !== "number") return null;
  const tier = confidenceTier(value);
  const color = tier === "high" ? "bg-success" : tier === "medium" ? "bg-warning" : "bg-destructive";
  const text =
    tier === "high" ? "text-success" : tier === "medium" ? "text-amber-600 dark:text-amber-400" : "text-destructive";
  return (
    <span className="flex items-center gap-1.5" title={`Extraction confidence: ${Math.round(value * 100)}%`}>
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className={`text-xs font-medium ${text}`}>{Math.round(value * 100)}%</span>
    </span>
  );
}

function FieldLabel({
  htmlFor,
  children,
  confidence,
  sourceQuote,
}: {
  htmlFor: string;
  children: React.ReactNode;
  confidence?: number;
  sourceQuote?: string | null;
}) {
  const isLowConfidence = confidence !== undefined && confidenceTier(confidence) === "low";
  
  return (
    <div className="flex flex-col gap-1.5 mb-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={htmlFor}>{children}</Label>
        <FieldConfidence value={confidence} />
      </div>
      {isLowConfidence && sourceQuote && (
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md border border-border/50">
          <span className="font-semibold text-primary/80 block mb-1">Source Quote:</span>
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sourceQuote) }} />
        </div>
      )}
    </div>
  );
}

export default function ReviewResumeDrawer({ isOpen, onClose, data, onSaved }: ReviewResumeDrawerProps) {
  const [formData, setFormData] = useState<Partial<ExtractedResume>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data && isOpen) {
      setFormData({
        candidate_name: data.candidate_name || "",
        years_of_experience: data.years_of_experience || 0,
        education_level: data.education_level || "",
        skills: data.skills || [],
        previous_companies: data.previous_companies || [],
      });
      setError(null);
    }
  }, [data, isOpen]);

  const conf = (f: ConfidenceField): number | undefined => data?.confidence?.[f];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "number" ? Number(value) : value }));
  };
  
  const handleListChange = (name: string, value: string) => {
    const arr = value.split(",").map((s) => s.trim()).filter(Boolean);
    setFormData((prev) => ({ ...prev, [name]: arr }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(apiUrl(`/api/v1/review/resume/${data.document_id}`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidate_name: formData.candidate_name,
          years_of_experience: formData.years_of_experience,
          education_level: formData.education_level,
          skills: formData.skills,
          previous_companies: formData.previous_companies,
        }),
      });

      if (!res.ok) {
        let msg = "Failed to save review.";
        try {
          const errData = await res.json();
          msg = errData.detail || msg;
        } catch {
          // ignore parsing error
        }
        throw new Error(msg);
      }

      toast.success("Resume data updated and verified.");
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-full max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex h-full flex-col md:flex-row">
          <div className="flex h-full w-full flex-col overflow-y-auto border-r border-border bg-card md:w-1/3">
            <DialogHeader className="border-b p-6 pb-4 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-display">
                <FileText className="h-5 w-5 text-primary" />
                Review Extracted Resume
              </DialogTitle>
              <DialogDescription>
                {data?.needs_review
                  ? "Review the low-confidence fields highlighted below. Original quotes from the resume are provided where possible."
                  : "Make corrections to the parsed metadata."}
              </DialogDescription>
            </DialogHeader>

            {data && (
              <div className="m-6 mb-0 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-start gap-2 text-sm">
                  <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="w-full overflow-hidden">
                    <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Filename</p>
                    <p className="truncate font-medium text-foreground" title={data.filename || "Unknown"}>
                      {data.filename || "Unknown"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="w-full overflow-hidden">
                    <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Uploaded</p>
                    <p className="truncate font-medium text-foreground">
                      {data.upload_time ? new Date(data.upload_time).toLocaleString() : "Unknown"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <FieldLabel htmlFor="candidate_name" confidence={conf("candidate_name")} sourceQuote={data?.candidate_name_source_quote}>
                  Candidate Name
                </FieldLabel>
                <Input
                  id="candidate_name"
                  name="candidate_name"
                  value={formData.candidate_name || ""}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="years_of_experience" confidence={conf("years_of_experience")} sourceQuote={data?.years_of_experience_source_quote}>
                  Years of Experience
                </FieldLabel>
                <Input
                  id="years_of_experience"
                  name="years_of_experience"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.years_of_experience || 0}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <FieldLabel htmlFor="education_level" confidence={conf("education_level")} sourceQuote={data?.education_level_source_quote}>
                  Education Level
                </FieldLabel>
                <Input
                  id="education_level"
                  name="education_level"
                  value={formData.education_level || ""}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <FieldLabel htmlFor="skills" confidence={conf("skills")} sourceQuote={data?.skills_source_quote}>
                  Skills (comma separated)
                </FieldLabel>
                <Input
                  id="skills"
                  name="skills"
                  value={formData.skills ? formData.skills.join(", ") : ""}
                  onChange={(e) => handleListChange("skills", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <FieldLabel htmlFor="previous_companies" confidence={conf("previous_companies")} sourceQuote={data?.previous_companies_source_quote}>
                  Previous Companies (comma separated)
                </FieldLabel>
                <Input
                  id="previous_companies"
                  name="previous_companies"
                  value={formData.previous_companies ? formData.previous_companies.join(", ") : ""}
                  onChange={(e) => handleListChange("previous_companies", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
            </form>

            <DialogFooter className="border-t bg-muted/20 p-6">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving} className="min-w-[120px]">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save & Verify"
                )}
              </Button>
            </DialogFooter>
          </div>

          <div className="flex h-full w-full flex-col border-l border-border bg-muted/40 md:w-2/3">
            <div className="z-10 flex shrink-0 items-center border-b border-border bg-card px-4 py-3 shadow-sm">
              <span className="text-sm font-semibold text-foreground">Resume preview</span>
            </div>
            <div className="relative flex-1 overflow-hidden bg-background">
              {data?.document_id ? (
                <iframe
                  src={apiUrl(`/api/v1/documents/${data.document_id}/file`)}
                  className="absolute inset-0 h-full w-full border-0 bg-white"
                  title="Resume Preview"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <p>No resume selected</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

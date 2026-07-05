"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle, FileText, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiUrl } from "@/lib/api";
import { type ExtractedData, type ConfidenceMap, confidenceTier } from "@/lib/contracts";
import DOMPurify from "dompurify";

interface ReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExtractedData | null;
  onSaved: () => void;
}

type ConfidenceField = keyof ConfidenceMap;

/** Small colored confidence indicator shown next to a field label. */
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

export default function ReviewDrawer({ isOpen, onClose, data, onSaved }: ReviewDrawerProps) {
  const [formData, setFormData] = useState<Partial<ExtractedData>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data && isOpen) {
      setFormData({
        party_name: data.party_name || "",
        contract_value: data.contract_value || 0,
        payment_terms_days: data.payment_terms_days || 0,
        penalty_clause_exists: data.penalty_clause_exists || false,
        governing_law: data.governing_law || "",
      });
      setError(null);
    }
  }, [data, isOpen]);

  const conf = (f: ConfidenceField): number | undefined => data?.confidence?.[f];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "number" ? Number(value) : value }));
  };

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, penalty_clause_exists: value === "true" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !data.needs_review) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(apiUrl(`/api/v1/review/${data.document_id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, operator_id: "ui_operator_01" }),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 403) {
            throw new Error("Insufficient Permissions: Only Managers or Admins can approve reviews.");
        }
        throw new Error("Failed to save changes");
      }

      toast.success("Review saved and verified.");
      onSaved();
      onClose();
    } catch (err: any) {
      const msg = err.message || "An error occurred while saving the review.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const isReadOnly = data ? !data.needs_review : true;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden p-0">
        <div className="flex h-full flex-col md:flex-row">
          {/* Left: form & metadata */}
          <div className="flex h-full w-full flex-col overflow-y-auto border-r border-border bg-card md:w-1/3">
            <div className="p-6">
              <DialogHeader className="mb-6 text-left">
                <DialogTitle className="flex items-center gap-3 text-xl">
                  {isReadOnly ? "Document details" : "Review extracted data"}
                  {!isReadOnly ? (
                    <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      Needs review
                    </Badge>
                  ) : (
                    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Verified
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {isReadOnly
                    ? "View the verified metadata and the original document side-by-side."
                    : "Verify and correct the extracted metadata before saving it."}
                </DialogDescription>
              </DialogHeader>

              {data && (
                <div className="mb-6 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
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

              {error && (
                <div className="mb-6 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex-1 space-y-5 pb-4">
                <div className="space-y-2">
                  <FieldLabel htmlFor="party_name" confidence={conf("party_name")} sourceQuote={data?.party_name_source_quote}>Party name</FieldLabel>
                  <Input id="party_name" name="party_name" value={formData.party_name as string} onChange={handleChange} disabled={isReadOnly} className="disabled:opacity-80" />
                </div>

                <div className="space-y-2">
                  <FieldLabel htmlFor="contract_value" confidence={conf("contract_value")} sourceQuote={data?.contract_value_source_quote}>Contract value ($)</FieldLabel>
                  <Input id="contract_value" type="number" name="contract_value" value={formData.contract_value as number} onChange={handleChange} disabled={isReadOnly} className="disabled:opacity-80" />
                </div>

                <div className="space-y-2">
                  <FieldLabel htmlFor="payment_terms_days" confidence={conf("payment_terms_days")} sourceQuote={data?.payment_terms_days_source_quote}>Payment terms (days)</FieldLabel>
                  <Input id="payment_terms_days" type="number" name="payment_terms_days" value={formData.payment_terms_days as number} onChange={handleChange} disabled={isReadOnly} className="disabled:opacity-80" />
                </div>

                <div className="space-y-2">
                  <FieldLabel htmlFor="penalty_clause_exists" confidence={conf("penalty_clause_exists")} sourceQuote={data?.penalty_clause_exists_source_quote}>Penalty clause exists</FieldLabel>
                  <Select value={String(formData.penalty_clause_exists)} onValueChange={handleSelectChange} disabled={isReadOnly}>
                    <SelectTrigger id="penalty_clause_exists" className="disabled:opacity-80">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <FieldLabel htmlFor="governing_law" confidence={conf("governing_law")} sourceQuote={data?.governing_law_source_quote}>Governing law</FieldLabel>
                  <Input id="governing_law" type="text" name="governing_law" value={formData.governing_law as string} onChange={handleChange} disabled={isReadOnly} className="disabled:opacity-80" />
                </div>

                <DialogFooter className="pt-8">
                  {isReadOnly ? (
                    <Button type="button" variant="default" className="w-full" onClick={onClose}>
                      Close
                    </Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSaving ? "Saving…" : "Save & verify"}
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </form>
            </div>
          </div>

          {/* Right: document viewer */}
          <div className="flex h-full w-full flex-col border-l border-border bg-muted/40 md:w-2/3">
            <div className="z-10 flex shrink-0 items-center border-b border-border bg-card px-4 py-3 shadow-sm">
              <span className="text-sm font-semibold text-foreground">Document preview</span>
            </div>
            <div className="relative flex-1 overflow-hidden bg-background">
              {data?.document_id ? (
                <iframe
                  src={apiUrl(`/api/v1/documents/${data.document_id}/file`)}
                  className="absolute inset-0 h-full w-full border-0 bg-white"
                  title="Document Preview"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <p>No document selected</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import React, { useState } from "react";
import DOMPurify from "dompurify";
import { Search, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ChunkResult {
  document_id: string;
  chunk_text: string;
  similarity: number;
}

interface GlobalSearchResponse {
  answer: string;
  sources: ChunkResult[];
}

interface GlobalSearchBarProps {
  /** Scopes the semantic search to only this kind of document. */
  documentType: "contract" | "resume";
}

export default function GlobalSearchBar({ documentType }: GlobalSearchBarProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GlobalSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const placeholder =
    documentType === "resume"
      ? "Ask about your resumes (e.g. 'Who has the most Python experience?')"
      : "Ask about your contracts (e.g. 'What is the standard payment term?')";

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // POST /api/v1/global-search — scoped to the active section.
      const data = await apiFetch<GlobalSearchResponse>("/api/v1/global-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: query.trim(), document_type: documentType }),
      });
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to execute search.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full mx-auto mb-8">
      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:relative sm:flex-row sm:items-center">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-12 pr-4 text-foreground shadow-xl shadow-black/20 backdrop-blur-xl transition-all placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary sm:pr-28"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 py-1.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:absolute sm:right-2 sm:top-1/2 sm:h-auto sm:w-auto sm:-translate-y-1/2"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Search"}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 p-6 bg-white/[0.06] border border-white/10 backdrop-blur-xl rounded-xl shadow-xl shadow-black/20 space-y-4 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            AI Analysis
          </h3>
          {/* The LLM answer is plain text; render it as text (whitespace preserved) rather
              than injecting it as HTML. */}
          <p className="max-w-none whitespace-pre-wrap text-muted-foreground leading-relaxed">
            {result.answer}
          </p>

          {result.sources.length > 0 && (
            <div className="pt-4 border-t border-border mt-6">
              <h4 className="text-sm font-medium text-foreground mb-3">Sources (Top {result.sources.length})</h4>
              <div className="grid gap-3">
                {result.sources.map((src, idx) => (
                  <div key={idx} className="p-3 bg-white/5 rounded-lg text-sm text-muted-foreground border border-white/10">
                    <p className="mb-1 text-xs text-primary/80 font-medium font-mono">DOC ID: {src.document_id}</p>
                    {/* Sanitize chunk text too, as it comes from potentially untrusted PDFs */}
                    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(src.chunk_text) }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

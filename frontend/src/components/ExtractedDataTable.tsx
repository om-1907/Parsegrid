"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, RefreshCcw, AlertCircle, Search, Inbox } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { type ExtractedData, confidenceTier } from "@/lib/contracts";

export type { ExtractedData } from "@/lib/contracts";

interface ExtractedDataTableProps {
  onRowSelect?: (row: ExtractedData) => void;
  refreshTrigger?: number;
  onDataChange?: (rows: ExtractedData[], loading: boolean) => void;
}

type SortField = keyof ExtractedData;
type SortOrder = "asc" | "desc";

/** Lowest available field confidence for a row, or null if none present. */
function rowConfidence(row: ExtractedData): number | null {
  const values = row.confidence ? Object.values(row.confidence).filter((v): v is number => typeof v === "number") : [];
  return values.length ? Math.min(...values) : null;
}

export default function ExtractedDataTable({ onRowSelect, refreshTrigger = 0, onDataChange }: ExtractedDataTableProps) {
  const [data, setData] = useState<ExtractedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [minValue, setMinValue] = useState<number | "">("");
  const [requiresReview, setRequiresReview] = useState<string>("all");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("upload_time");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (minValue !== "") params.append("min_value", minValue.toString());
      if (requiresReview !== "all") params.append("requires_review", requiresReview);

      const result = await apiFetch<ExtractedData[]>(`/api/v1/query?${params.toString()}`);
      setData(result);
      setError(null);
    } catch {
      setError("Error loading extracted data.");
      toast.error("Couldn't load contracts. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, [minValue, requiresReview]);

  // Refetch on filter change and whenever the parent bumps refreshTrigger
  // (e.g. after an upload completes or a review is saved).
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  // Report data upward (for the stats overview) whenever it changes.
  useEffect(() => {
    onDataChange?.(data, loading);
  }, [data, loading, onDataChange]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const visibleData = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? data.filter((r) =>
          [r.party_name, r.governing_law, r.filename]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(q))
        )
      : data;

    return [...filtered].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === null || valA === undefined) return sortOrder === "asc" ? 1 : -1;
      if (valB === null || valB === undefined) return sortOrder === "asc" ? -1 : 1;
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, search, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 inline-block h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="ml-1 inline-block h-3.5 w-3.5" />
    );
  };

  const COLS = 8;

  return (
    <Card className="overflow-hidden rounded-2xl border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/40 py-4">
        <div>
          <CardTitle className="font-display text-xl">Extracted contracts</CardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loading ? "Loading…" : `${visibleData.length} of ${data.length} shown`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 border-b border-border bg-muted/20 p-4">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Party, governing law, filename…"
                className="bg-background pl-9"
              />
            </div>
          </div>
          <div className="w-32 space-y-1.5">
            <Label htmlFor="min-value">Min value ($)</Label>
            <Input
              id="min-value"
              type="number"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value ? Number(e.target.value) : "")}
              placeholder="0"
              className="bg-background"
            />
          </div>
          <div className="w-40 space-y-1.5">
            <Label>Status</Label>
            <Select value={requiresReview} onValueChange={setRequiresReview}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Needs review</SelectItem>
                <SelectItem value="false">Verified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                {(
                  [
                    ["party_name", "Party name"],
                    ["contract_value", "Value"],
                    ["payment_terms_days", "Terms (days)"],
                    ["penalty_clause_exists", "Penalty"],
                    ["governing_law", "Governing law"],
                    ["confidence", "Confidence"],
                    ["upload_time", "Uploaded"],
                    ["needs_review", "Status"],
                  ] as [SortField, string][]
                ).map(([field, label]) => (
                  <TableHead
                    key={field}
                    className="cursor-pointer whitespace-nowrap transition-colors hover:text-foreground"
                    onClick={() => field !== "confidence" && handleSort(field)}
                  >
                    {label}
                    <SortIcon field={field} />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: COLS }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-[120px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : visibleData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLS} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Inbox className="h-8 w-8 opacity-40" />
                      <span>No contracts match your filters.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                visibleData.map((row) => {
                  const conf = rowConfidence(row);
                  return (
                    <TableRow
                      key={row.id}
                      className={`cursor-pointer ${row.needs_review ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-muted/50"}`}
                      onClick={() => onRowSelect?.(row)}
                    >
                      <TableCell className="font-medium text-foreground">
                        {row.party_name || <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell>
                        {row.contract_value ? `$${row.contract_value.toLocaleString()}` : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell>
                        {row.payment_terms_days ?? <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell>
                        {row.penalty_clause_exists !== null ? (row.penalty_clause_exists ? "Yes" : "No") : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell>
                        {row.governing_law || <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell>
                        <ConfidenceCell value={conf} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {row.upload_time ? new Date(row.upload_time).toLocaleString() : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell>
                        {row.needs_review ? (
                          <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400">
                            Needs review
                          </Badge>
                        ) : (
                          <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400">
                            Verified
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfidenceCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground/50">—</span>;
  const tier = confidenceTier(value);
  const color =
    tier === "high" ? "bg-success" : tier === "medium" ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{Math.round(value * 100)}%</span>
    </div>
  );
}

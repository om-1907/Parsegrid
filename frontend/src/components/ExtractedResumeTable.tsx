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
import { type ExtractedResume } from "@/lib/resumes";
import { confidenceTier } from "@/lib/contracts";

export type { ExtractedResume } from "@/lib/resumes";

interface ExtractedResumeTableProps {
  onRowSelect?: (row: ExtractedResume) => void;
  refreshTrigger?: number;
  onDataChange?: (rows: ExtractedResume[], loading: boolean) => void;
}

type SortField = keyof ExtractedResume;
type SortOrder = "asc" | "desc";

function rowConfidence(row: ExtractedResume): number | null {
  const values = row.confidence ? Object.values(row.confidence).filter((v): v is number => typeof v === "number") : [];
  return values.length ? Math.min(...values) : null;
}

export default function ExtractedResumeTable({ onRowSelect, refreshTrigger = 0, onDataChange }: ExtractedResumeTableProps) {
  const [data, setData] = useState<ExtractedResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [minExperience, setMinExperience] = useState<number | "">("");
  const [requiresReview, setRequiresReview] = useState<string>("all");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("upload_time");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (minExperience !== "") params.append("min_experience", minExperience.toString());
      if (requiresReview !== "all") params.append("requires_review", requiresReview);

      const result = await apiFetch<ExtractedResume[]>(`/api/v1/query/resumes?${params.toString()}`);
      setData(result);
      setError(null);
    } catch {
      setError("Failed to load parsed resumes.");
      toast.error("Failed to fetch resume data from server.");
    } finally {
      setLoading(false);
    }
  }, [minExperience, requiresReview]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  useEffect(() => {
    if (onDataChange) {
      onDataChange(data, loading);
    }
  }, [data, loading, onDataChange]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filteredAndSortedData = useMemo(() => {
    let filtered = [...data];
    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(
        (row) =>
          row.candidate_name?.toLowerCase().includes(lowerSearch) ||
          row.education_level?.toLowerCase().includes(lowerSearch) ||
          row.skills?.join(" ").toLowerCase().includes(lowerSearch) ||
          row.previous_companies?.join(" ").toLowerCase().includes(lowerSearch) ||
          row.filename?.toLowerCase().includes(lowerSearch)
      );
    }

    filtered.sort((a, b) => {
      let valA: any = a[sortField] ?? "";
      let valB: any = b[sortField] ?? "";

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [data, search, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? <ArrowUp className="ml-1 inline h-4 w-4" /> : <ArrowDown className="ml-1 inline h-4 w-4" />;
  };

  return (
    <Card className="rounded-2xl border-white/10 bg-white/[0.06] shadow-xl shadow-black/20 backdrop-blur-xl flex flex-col min-h-[500px]">
      <CardHeader className="flex flex-col space-y-4 pb-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="font-display text-xl">Parsed Resumes</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Review extracted resume data and candidate metadata.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="w-full sm:w-auto">
          <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <div className="border-b border-white/10 bg-white/[0.02] p-4 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-1 lg:col-span-2">
              <Label htmlFor="search" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search candidates, skills, companies..."
                  className="pl-9 h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="minExp" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Min Experience
              </Label>
              <Input
                id="minExp"
                type="number"
                placeholder="Years..."
                className="h-9"
                value={minExperience}
                onChange={(e) => setMinExperience(e.target.value ? Number(e.target.value) : "")}
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="review" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </Label>
              <Select value={requiresReview} onValueChange={setRequiresReview}>
                <SelectTrigger id="review" className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resumes</SelectItem>
                  <SelectItem value="true">Needs Review</SelectItem>
                  <SelectItem value="false">Verified</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto relative">
          <Table className="w-full min-w-[800px]">
            <TableHeader className="bg-white/[0.04] backdrop-blur-xl sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[120px] font-semibold text-foreground">Status</TableHead>
                <TableHead className="w-[200px] cursor-pointer font-semibold text-foreground hover:bg-muted" onClick={() => handleSort("candidate_name")}>
                  Candidate <SortIcon field="candidate_name" />
                </TableHead>
                <TableHead className="cursor-pointer font-semibold text-foreground hover:bg-muted" onClick={() => handleSort("years_of_experience")}>
                  Experience <SortIcon field="years_of_experience" />
                </TableHead>
                <TableHead className="cursor-pointer font-semibold text-foreground hover:bg-muted" onClick={() => handleSort("education_level")}>
                  Education <SortIcon field="education_level" />
                </TableHead>
                <TableHead className="w-[250px] font-semibold text-foreground">Skills</TableHead>
                <TableHead className="cursor-pointer font-semibold text-foreground hover:bg-muted" onClick={() => handleSort("upload_time")}>
                  Upload Date <SortIcon field="upload_time" />
                </TableHead>
              </TableRow>
            </TableHeader>
            
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-destructive">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-8 w-8" />
                      <p>{error}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Inbox className="h-8 w-8 text-muted-foreground/50" />
                      <p>No resumes match the current filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((row) => {
                  const conf = rowConfidence(row);
                  const isVerified = !row.needs_review;
                  
                  return (
                    <TableRow 
                      key={row.id} 
                      className={`cursor-pointer transition-colors hover:bg-muted/60 ${row.needs_review ? "bg-amber-500/5 dark:bg-amber-500/10" : ""}`}
                      onClick={() => onRowSelect && onRowSelect(row)}
                    >
                      <TableCell>
                        <Badge variant={isVerified ? "outline" : "warning"} className="font-medium">
                          {isVerified ? "Verified" : "Needs Review"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{row.candidate_name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground truncate w-[180px]">{row.filename}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">
                        {row.years_of_experience != null ? `${row.years_of_experience} yrs` : "N/A"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.education_level || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.skills?.slice(0, 3).map((skill, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] font-normal">{skill}</Badge>
                          ))}
                          {row.skills?.length > 3 && (
                            <span className="text-xs text-muted-foreground ml-1">+{row.skills.length - 3}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                        {row.upload_time ? new Date(row.upload_time).toLocaleDateString() : "Unknown"}
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

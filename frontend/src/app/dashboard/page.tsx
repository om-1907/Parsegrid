"use client";

import React, { useState, useCallback } from "react";
import { FileText, Users } from "lucide-react";
import DocumentUploader from "@/components/DocumentUploader";
import ProcessingQueue from "@/components/ProcessingQueue";
import ExtractedDataTable from "@/components/ExtractedDataTable";
import ExtractedResumeTable from "@/components/ExtractedResumeTable";
import GlobalSearchBar from "@/components/GlobalSearchBar";
import ReviewDrawer from "@/components/ReviewDrawer";
import ReviewResumeDrawer from "@/components/ReviewResumeDrawer";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { ResumeStatsOverview } from "@/components/dashboard/ResumeStatsOverview";
import { type ExtractedData } from "@/lib/contracts";
import { type ExtractedResume } from "@/lib/resumes";
import { cn } from "@/lib/utils";

type Tab = "contracts" | "resumes";

export default function Dashboard() {
  // Contracts is the default/first section.
  const [tab, setTab] = useState<Tab>("contracts");

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {tab === "contracts" ? "Legal Dashboard" : "HR Recruiting Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            {tab === "contracts"
              ? "AI-powered contract processing and metadata extraction"
              : "AI-powered resume parsing and candidate insights"}
          </p>
        </div>

        {/* Segmented tab control — Contracts first. */}
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.06] p-1 shadow-xl shadow-black/20 backdrop-blur-xl">
          <TabButton active={tab === "contracts"} onClick={() => setTab("contracts")} icon={FileText}>
            Contracts
          </TabButton>
          <TabButton active={tab === "resumes"} onClick={() => setTab("resumes")} icon={Users}>
            Resumes
          </TabButton>
        </div>
      </header>

      {tab === "contracts" ? <ContractsSection /> : <ResumesSection />}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

/* ─────────────────────────── Contracts ─────────────────────────── */

function ContractsSection() {
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ExtractedData | null>(null);
  const [tableData, setTableData] = useState<ExtractedData[]>([]);
  const [tableLoading, setTableLoading] = useState(true);

  const handleUploadSuccess = useCallback((docIds: string[]) => {
    if (docIds.length === 1) {
      setActiveDocId(docIds[0]);
    } else {
      setActiveDocId(null);
      setRefreshTrigger((p) => p + 1);
    }
  }, []);
  const handleProcessingComplete = useCallback(() => setRefreshTrigger((p) => p + 1), []);
  const handleRowSelect = useCallback((row: ExtractedData) => {
    setSelectedRow(row);
    setIsReviewOpen(true);
  }, []);
  const handleReviewSaved = useCallback(() => setRefreshTrigger((p) => p + 1), []);
  const handleReviewClose = useCallback(() => {
    setIsReviewOpen(false);
    setSelectedRow(null);
  }, []);
  const handleTableData = useCallback((rows: ExtractedData[], loading: boolean) => {
    setTableData(rows);
    setTableLoading(loading);
  }, []);

  return (
    <div className="space-y-8">
      <GlobalSearchBar documentType="contract" />

      <StatsOverview data={tableData} loading={tableLoading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-1">
          <DocumentUploader documentType="contract" onUploadSuccess={handleUploadSuccess} />
          {activeDocId && (
            <ProcessingQueue docId={activeDocId} onProcessingComplete={handleProcessingComplete} />
          )}
        </section>

        <section className="lg:col-span-2">
          <ExtractedDataTable
            onRowSelect={handleRowSelect}
            refreshTrigger={refreshTrigger}
            onDataChange={handleTableData}
          />
        </section>
      </div>

      <ReviewDrawer
        isOpen={isReviewOpen}
        onClose={handleReviewClose}
        data={selectedRow}
        onSaved={handleReviewSaved}
      />
    </div>
  );
}

/* ─────────────────────────── Resumes ─────────────────────────── */

function ResumesSection() {
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ExtractedResume | null>(null);
  const [tableData, setTableData] = useState<ExtractedResume[]>([]);
  const [tableLoading, setTableLoading] = useState(true);

  const handleUploadSuccess = useCallback((docIds: string[]) => {
    if (docIds.length === 1) {
      setActiveDocId(docIds[0]);
    } else {
      setActiveDocId(null);
      setRefreshTrigger((p) => p + 1);
    }
  }, []);
  const handleProcessingComplete = useCallback(() => setRefreshTrigger((p) => p + 1), []);
  const handleRowSelect = useCallback((row: ExtractedResume) => {
    setSelectedRow(row);
    setIsReviewOpen(true);
  }, []);
  const handleReviewSaved = useCallback(() => setRefreshTrigger((p) => p + 1), []);
  const handleReviewClose = useCallback(() => {
    setIsReviewOpen(false);
    setSelectedRow(null);
  }, []);
  const handleTableData = useCallback((rows: ExtractedResume[], loading: boolean) => {
    setTableData(rows);
    setTableLoading(loading);
  }, []);

  return (
    <div className="space-y-8">
      <GlobalSearchBar documentType="resume" />

      <ResumeStatsOverview data={tableData} loading={tableLoading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-1">
          <DocumentUploader documentType="resume" onUploadSuccess={handleUploadSuccess} />
          {activeDocId && (
            <ProcessingQueue docId={activeDocId} onProcessingComplete={handleProcessingComplete} />
          )}
        </section>

        <section className="lg:col-span-2">
          <ExtractedResumeTable
            onRowSelect={handleRowSelect}
            refreshTrigger={refreshTrigger}
            onDataChange={handleTableData}
          />
        </section>
      </div>

      <ReviewResumeDrawer
        isOpen={isReviewOpen}
        onClose={handleReviewClose}
        data={selectedRow}
        onSaved={handleReviewSaved}
      />
    </div>
  );
}

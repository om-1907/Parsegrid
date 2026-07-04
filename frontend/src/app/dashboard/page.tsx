"use client";

import React, { useState, useCallback } from "react";
import DocumentUploader from "@/components/DocumentUploader";
import ProcessingQueue from "@/components/ProcessingQueue";
import ExtractedDataTable from "@/components/ExtractedDataTable";
import GlobalSearchBar from "@/components/GlobalSearchBar";
import ReviewDrawer from "@/components/ReviewDrawer";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { type ExtractedData } from "@/lib/contracts";

export default function Dashboard() {
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ExtractedData | null>(null);

  const [tableData, setTableData] = useState<ExtractedData[]>([]);
  const [tableLoading, setTableLoading] = useState(true);

  const handleUploadSuccess = useCallback((docId: string) => setActiveDocId(docId), []);
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
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">AI-powered contract processing and metadata extraction</p>
      </header>

      <GlobalSearchBar />

      <StatsOverview data={tableData} loading={tableLoading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-1">
          <DocumentUploader onUploadSuccess={handleUploadSuccess} />
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
    </main>
  );
}

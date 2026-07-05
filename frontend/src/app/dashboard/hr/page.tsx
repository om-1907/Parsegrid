"use client";

import React, { useState, useCallback } from "react";
import DocumentUploader from "@/components/DocumentUploader";
import ProcessingQueue from "@/components/ProcessingQueue";
import ExtractedResumeTable from "@/components/ExtractedResumeTable";
import ReviewResumeDrawer from "@/components/ReviewResumeDrawer";
import { type ExtractedResume } from "@/lib/resumes";

export default function HRDashboard() {
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
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">HR Recruiting Dashboard</h1>
        <p className="text-muted-foreground">AI-powered resume parsing and candidate matching</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-1">
          <DocumentUploader onUploadSuccess={handleUploadSuccess} />
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
    </main>
  );
}

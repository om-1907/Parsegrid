"use client";

import React, { useEffect, useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { apiUrl } from "@/lib/api";

interface ProcessingQueueProps {
  docId: string;
  onProcessingComplete: () => void;
}

type Status = "pending" | "processing" | "completed" | "failed" | "unknown";

export default function ProcessingQueue({ docId, onProcessingComplete }: ProcessingQueueProps) {
  const [status, setStatus] = useState<Status>("pending");
  const [error, setError] = useState<string | null>(null);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const res = await fetch(apiUrl(`/api/v1/status/${docId}`), { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch status");
        const data = await res.json();
        const currentStatus = data.status as Status;
        setStatus(currentStatus);

        if (currentStatus === "completed" || currentStatus === "failed") {
          clearInterval(intervalId);
          if (currentStatus === "completed" && !hasCompletedRef.current) {
            hasCompletedRef.current = true;
            onProcessingComplete();
          }
        }
      } catch {
        setError("Error polling status");
        clearInterval(intervalId);
      }
    };

    // Declared after pollStatus, but only read once the interval/explicit call
    // fires — so it is fully initialized by the time it is used.
    const intervalId = setInterval(pollStatus, 2000);
    pollStatus();
    return () => clearInterval(intervalId);
  }, [docId, onProcessingComplete]);

  const milestones = [
    { id: "pending", label: "Queued", Icon: Clock },
    { id: "processing", label: "Extracting data", Icon: Loader2 },
    { id: "completed", label: "Ready", Icon: CheckCircle2 },
  ];

  const getStatusIndex = (current: Status) => {
    if (current === "failed") return -1;
    return milestones.findIndex((m) => m.id === current);
  };

  const currentIndex = getStatusIndex(status);

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-4 rounded-2xl border-border shadow-sm duration-500">
      <CardHeader className="pb-4">
        <CardTitle className="font-display text-lg font-semibold">Processing document</CardTitle>
        <p className="truncate font-mono text-sm text-muted-foreground">ID: {docId}</p>
      </CardHeader>

      <CardContent>
        <div className="space-y-1">
          {milestones.map((milestone, index) => {
            const isCompleted = currentIndex > index || status === "completed";
            const isActive = currentIndex === index && status !== "completed" && status !== "failed";
            const isFailed = status === "failed" && index === 2;

            let iconColor = "text-muted-foreground/40 bg-muted";
            if (isCompleted) iconColor = "text-success bg-success/10";
            if (isActive) iconColor = "text-primary bg-primary/10";
            if (isFailed) iconColor = "text-destructive bg-destructive/10";

            const Icon = isFailed ? XCircle : isCompleted ? CheckCircle2 : milestone.Icon;
            const isLast = index === milestones.length - 1;

            return (
              <div key={milestone.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconColor}`}>
                    <Icon className={`h-5 w-5 ${isActive && milestone.id === "processing" ? "animate-spin" : ""}`} />
                  </div>
                  {!isLast && (
                    <div className={`my-1 h-6 w-0.5 rounded ${isCompleted ? "bg-success/40" : "bg-border"}`} />
                  )}
                </div>
                <div className={`pt-2 ${isActive || isCompleted || isFailed ? "opacity-100" : "opacity-50"}`}>
                  <h4 className={`font-medium ${isFailed ? "text-destructive" : "text-foreground"}`}>
                    {isFailed ? "Extraction failed" : milestone.label}
                  </h4>
                  {isActive && <p className="text-sm text-muted-foreground">Working…</p>}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}
      </CardContent>
    </Card>
  );
}

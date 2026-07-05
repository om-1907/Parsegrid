"use client";

import React, { useState, useCallback } from "react";
import { toast } from "sonner";
import { UploadCloud, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";

interface DocumentUploaderProps {
  /** The section preset. The backend may still auto-correct this from the file's content. */
  documentType: "contract" | "resume";
  onUploadSuccess: (docIds: string[]) => void;
}

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv", ".html", ".htm", ".zip"];

export default function DocumentUploader({ documentType, onUploadSuccess }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = documentType === "resume" ? "resume(s)" : "contract(s)";

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const uploadFiles = (fileList: FileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const rejected = files.filter(
      (f) => !ALLOWED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    if (rejected.length > 0) {
      const msg = `Unsupported file(s): ${rejected.map((f) => f.name).join(", ")}. Allowed: PDF, DOCX, TXT, MD, CSV, HTML, ZIP.`;
      setError(msg);
      toast.error(msg);
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    // All files go up in ONE request (the backend accepts a list). This keeps large
    // batches under the per-request upload rate limit and lets a ZIP expand server-side.
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("document_type", documentType);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", apiUrl("/api/v1/upload"), true);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 202 || xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setUploadProgress(100);

          const ids: string[] = response.ids ?? (response.id ? [response.id] : []);
          const skipped: number = response.skipped ?? 0;
          const errs: string[] = response.errors ?? [];

          let msg = `Queued ${ids.length} ${label} for extraction.`;
          if (skipped) msg += ` Skipped ${skipped} duplicate(s).`;
          toast.success(msg);
          if (errs.length > 0) toast.warning(`${errs.length} file(s) had issues: ${errs.slice(0, 3).join("; ")}`);

          if (ids.length > 0) onUploadSuccess(ids);
        } else {
          let msg = "Upload failed with status " + xhr.status;
          try {
            msg = JSON.parse(xhr.responseText).detail || msg;
          } catch {
            /* non-JSON error body */
          }
          setError(msg);
          toast.error(msg);
        }
        setIsUploading(false);
      };

      xhr.onerror = () => {
        const msg = "Network error while uploading. Is the backend running?";
        setError(msg);
        toast.error(msg);
        setIsUploading(false);
      };

      xhr.send(formData);
    } catch {
      const msg = "An unexpected error occurred.";
      setError(msg);
      toast.error(msg);
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentType]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      // Allow re-selecting the same file(s) again.
      e.target.value = "";
    }
  };

  return (
    <Card className="rounded-2xl border-white/10 bg-white/[0.06] shadow-xl shadow-black/20 backdrop-blur-xl">
      <CardContent className="pt-6">
        <div
          className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors
            ${isDragging ? "border-primary bg-primary/10" : "border-white/15 hover:bg-white/5"}
            ${isUploading ? "opacity-70 pointer-events-none" : ""}
          `}
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.csv,.html,.htm,.zip"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-default"
            id="file-upload"
            onChange={handleFileChange}
            disabled={isUploading}
          />

          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {isUploading ? (
              <FileText className="h-8 w-8 animate-pulse text-primary" />
            ) : (
              <UploadCloud className={`h-8 w-8 ${isDragging ? "text-primary" : ""}`} />
            )}
          </div>

          <h3 className="mb-2 font-display text-xl font-semibold text-foreground">
            Upload {documentType === "resume" ? "Resumes" : "Contracts"}
          </h3>
          <p className="mb-6 max-w-sm text-center text-muted-foreground">
            Drag &amp; drop one or more files here, or click to browse. Upload a{" "}
            <span className="font-medium text-foreground">.zip</span> to process up to dozens of
            documents at once.
          </p>

          <Button variant="default" className="pointer-events-none" disabled={isUploading}>
            Browse files
          </Button>

          {isUploading && (
            <div className="mt-8 w-full max-w-xs space-y-2">
              <div className="flex justify-between text-sm font-medium text-foreground">
                <span>Uploading…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 w-full rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

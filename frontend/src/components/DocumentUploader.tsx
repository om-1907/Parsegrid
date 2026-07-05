"use client";

import React, { useState, useCallback } from "react";
import { toast } from "sonner";
import { UploadCloud, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";

interface DocumentUploaderProps {
  onUploadSuccess: (docIds: string[]) => void;
}

export default function DocumentUploader({ onUploadSuccess }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<"contract" | "resume">("contract");

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

  const uploadFile = async (file: File) => {
    const allowedExtensions = [".pdf", ".docx", ".txt", ".md", ".csv", ".html", ".htm", ".zip"];
    const fileName = file.name.toLowerCase();
    const hasAllowedExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasAllowedExtension) {
      const msg = "Supported formats: PDF, DOCX, TXT, MD, CSV, HTML, ZIP.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", documentType);

    try {
      // Using XMLHttpRequest to track progress
      const xhr = new XMLHttpRequest();
      xhr.open("POST", apiUrl("/api/v1/upload"), true);
      xhr.withCredentials = true;
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 202 || xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setUploadProgress(100);
          const isBatch = !!response.ids;
          const count = isBatch ? response.ids.length : 1;
          toast.success(isBatch ? `Queued ${count} documents for extraction.` : `"${file.name}" uploaded — extracting now.`);
          onUploadSuccess(isBatch ? response.ids : [response.id]);
        } else {
          let msg = "Upload failed with status " + xhr.status;
          try {
            const errResponse = JSON.parse(xhr.responseText);
            msg = errResponse.detail || msg;
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  };

  return (
    <Card className="rounded-2xl border-white/10 bg-white/[0.06] shadow-xl shadow-black/20 backdrop-blur-xl">
      <CardContent className="pt-6">
        <div
          className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors
            ${isDragging ? 'border-primary bg-primary/10' : 'border-white/15 hover:bg-white/5'}
            ${isUploading ? 'opacity-70 pointer-events-none' : ''}
          `}
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
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

          <h3 className="mb-2 font-display text-xl font-semibold text-foreground">Upload Document</h3>
          
          <div className="flex gap-2 mt-2 mb-4 z-20" onClick={(e) => e.stopPropagation()}>
            <Button 
              type="button"
              variant={documentType === "contract" ? "default" : "outline"}
              onClick={() => setDocumentType("contract")}
              disabled={isUploading}
            >
              Contract
            </Button>
            <Button 
              type="button"
              variant={documentType === "resume" ? "default" : "outline"}
              onClick={() => setDocumentType("resume")}
              disabled={isUploading}
            >
              Resume
            </Button>
          </div>
          <p className="mb-6 max-w-sm text-center text-muted-foreground">
            Drag and drop your document here, or click to browse files from your computer
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

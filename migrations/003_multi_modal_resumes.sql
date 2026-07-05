-- Migration to support Multi-Modal Document Parsing (Phase 1)
-- Run this in your Supabase SQL Editor

-- 1. Create DocumentType Enum
CREATE TYPE documenttype AS ENUM ('contract', 'resume');

-- 2. Alter Documents Table
ALTER TABLE documents 
  ADD COLUMN document_type documenttype NOT NULL DEFAULT 'contract',
  ADD COLUMN original_language VARCHAR(100),
  ADD COLUMN parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

-- 3. Create Extracted Resumes Table
CREATE TABLE extracted_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    candidate_name VARCHAR(255),
    years_of_experience DOUBLE PRECISION,
    education_level VARCHAR(255),
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    previous_companies JSONB NOT NULL DEFAULT '[]'::jsonb,
    needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    extracted_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Add Indexes for Extracted Resumes
CREATE INDEX ix_extracted_resumes_document_id ON extracted_resumes(document_id);
CREATE INDEX ix_extracted_resumes_needs_review ON extracted_resumes(needs_review);

-- 5. Enable Row Level Security (RLS) on new table
ALTER TABLE extracted_resumes ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for extracted_resumes (inherits document access)
CREATE POLICY "Users can access resumes belonging to their documents" ON extracted_resumes
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
    )
  );

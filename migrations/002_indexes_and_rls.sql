-- ============================================================================
-- Production Migration: Indexes + Row Level Security (RLS)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: Missing Indexes on frequently queried columns
-- ─────────────────────────────────────────────────────────────────────────────

-- documents table
CREATE INDEX IF NOT EXISTS ix_documents_user_id ON documents (user_id);
CREATE INDEX IF NOT EXISTS ix_documents_status ON documents (status);

-- extracted_data table
CREATE INDEX IF NOT EXISTS ix_extracted_data_document_id ON extracted_data (document_id);
CREATE INDEX IF NOT EXISTS ix_extracted_data_governing_law ON extracted_data (governing_law);
CREATE INDEX IF NOT EXISTS ix_extracted_data_contract_value ON extracted_data (contract_value);

-- audit_log table
CREATE INDEX IF NOT EXISTS ix_audit_log_doc_id ON audit_log (doc_id);
CREATE INDEX IF NOT EXISTS ix_audit_log_event_type ON audit_log (event_type);

-- document_chunks table
CREATE INDEX IF NOT EXISTS ix_document_chunks_document_id ON document_chunks (document_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: Row Level Security (RLS) — Tenant Isolation
-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: Since our FastAPI backend uses a service_role or direct connection
-- (which bypasses RLS), these policies act as a defense-in-depth layer.
-- They protect against any future Supabase client-side (anon key) access
-- and ensure no cross-tenant data leakage even if the API has a bug.

-- ── documents ────────────────────────────────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
    ON documents FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own documents"
    ON documents FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own documents"
    ON documents FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own documents"
    ON documents FOR DELETE
    USING (user_id = auth.uid());


-- ── extracted_data ───────────────────────────────────────────────────────────
ALTER TABLE extracted_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extracted data"
    ON extracted_data FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents
            WHERE documents.id = extracted_data.document_id
              AND documents.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own extracted data"
    ON extracted_data FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM documents
            WHERE documents.id = extracted_data.document_id
              AND documents.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own extracted data"
    ON extracted_data FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM documents
            WHERE documents.id = extracted_data.document_id
              AND documents.user_id = auth.uid()
        )
    );


-- ── document_chunks ──────────────────────────────────────────────────────────
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chunks"
    ON document_chunks FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chunks"
    ON document_chunks FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own chunks"
    ON document_chunks FOR DELETE
    USING (user_id = auth.uid());


-- ── audit_log ────────────────────────────────────────────────────────────────
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- No policies = no access via anon/authenticated roles.
-- The backend's service_role connection bypasses RLS automatically.

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION: Run this to confirm RLS is enabled
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

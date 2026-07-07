-- Migration 004: persist per-field extraction confidence + source quotes.
-- Idempotent. Run in Supabase SQL Editor or via apply_migration/migrate scripts.
--
-- Before this, worker.py computed per-field confidence (0..1) and verbatim
-- source quotes but discarded them, so the dashboard confidence bars were always
-- empty. These two JSONB maps (field -> score, field -> quote) back that UI.

ALTER TABLE extracted_data
  ADD COLUMN IF NOT EXISTS confidence   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_quotes JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE extracted_resumes
  ADD COLUMN IF NOT EXISTS confidence   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_quotes JSONB NOT NULL DEFAULT '{}'::jsonb;

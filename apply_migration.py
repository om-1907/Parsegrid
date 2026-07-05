import asyncio
from sqlalchemy import text
from models.database import async_engine

STATEMENTS = [
    # 1. Create DocumentType enum (skip if exists)
    """
    DO $$ BEGIN
        CREATE TYPE documenttype AS ENUM ('contract', 'resume');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
    """,
    # 2. Add document_type column
    """
    DO $$ BEGIN
        ALTER TABLE documents ADD COLUMN document_type documenttype NOT NULL DEFAULT 'contract';
    EXCEPTION
        WHEN duplicate_column THEN null;
    END $$;
    """,
    # 3. Add original_language column
    """
    DO $$ BEGIN
        ALTER TABLE documents ADD COLUMN original_language VARCHAR(100);
    EXCEPTION
        WHEN duplicate_column THEN null;
    END $$;
    """,
    # 4. Add parent_document_id column
    """
    DO $$ BEGIN
        ALTER TABLE documents ADD COLUMN parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL;
    EXCEPTION
        WHEN duplicate_column THEN null;
    END $$;
    """,
    # 5. Create extracted_resumes table
    """
    CREATE TABLE IF NOT EXISTS extracted_resumes (
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
    """,
    # 6. Indexes
    "CREATE INDEX IF NOT EXISTS ix_extracted_resumes_document_id ON extracted_resumes(document_id);",
    "CREATE INDEX IF NOT EXISTS ix_extracted_resumes_needs_review ON extracted_resumes(needs_review);",
    # 7. Enable RLS
    "ALTER TABLE extracted_resumes ENABLE ROW LEVEL SECURITY;",
]

async def run_migration():
    async with async_engine.begin() as conn:
        for i, stmt in enumerate(STATEMENTS, 1):
            try:
                await conn.execute(text(stmt))
                print(f"  [{i}/{len(STATEMENTS)}] OK")
            except Exception as e:
                print(f"  [{i}/{len(STATEMENTS)}] SKIPPED or ERROR: {e}")
        print("\nMigration complete!")

if __name__ == "__main__":
    asyncio.run(run_migration())

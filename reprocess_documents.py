"""
One-shot repair/backfill after the embedding-dimension fix.

Two classes of stale documents exist from before the fix:
  1. status='failed'  — the RAG dimension mismatch rolled back a *good* extraction.
                        Re-run the full pipeline (extract -> save -> ingest).
  2. status='completed' with 0 chunks — extracted before RAG existed, so they were
                        never indexed. Ingest their existing extracted_text only
                        (re-running extraction would duplicate the extracted_data row).

Idempotent: documents that already have chunks are skipped.

Run once:  python reprocess_documents.py
"""

import asyncio
import os

from sqlalchemy import select, func

import models.user  # register users table for FK resolution
from models.database import (
    AsyncSessionLocal,
    Document,
    DocumentChunk,
    ExtractedData,
    ExtractedResume,
    DocumentType,
)
from services.worker import process_document_pipeline
from services.rag_engine import ingest_document_to_rag

STORAGE_DIR = "./storage"


def _file_path_for(doc: Document) -> str:
    _, ext = os.path.splitext(doc.filename.lower())
    return os.path.join(STORAGE_DIR, f"{doc.id}{ext}")


async def _chunk_count(session, doc_id) -> int:
    return await session.scalar(
        select(func.count()).select_from(DocumentChunk).where(DocumentChunk.document_id == doc_id)
    )


async def main():
    async with AsyncSessionLocal() as session:
        docs = (await session.execute(select(Document).order_by(Document.upload_time))).scalars().all()

    print(f"Found {len(docs)} documents.\n")

    for doc in docs:
        async with AsyncSessionLocal() as session:
            existing_chunks = await _chunk_count(session, doc.id)
            if existing_chunks > 0:
                print(f"SKIP     {doc.filename:35.35} already indexed ({existing_chunks} chunks)")
                continue

            file_path = _file_path_for(doc)
            if not os.path.exists(file_path):
                print(f"MISSING  {doc.filename:35.35} file not on disk: {file_path}")
                continue

            if doc.status == "failed":
                # Re-run the full pipeline (idempotent: no extracted_data exists yet).
                print(f"REPROC   {doc.filename:35.35} status=failed -> full pipeline")
                await process_document_pipeline(doc.id, file_path, session)
            else:
                # completed but unindexed: ingest existing extracted_text only.
                if doc.document_type == DocumentType.resume:
                    row = await session.scalar(
                        select(ExtractedResume).where(ExtractedResume.document_id == doc.id)
                    )
                else:
                    row = await session.scalar(
                        select(ExtractedData).where(ExtractedData.document_id == doc.id)
                    )
                text = row.extracted_text if row else None
                if not text:
                    print(f"NO TEXT  {doc.filename:35.35} completed but no extracted_text; skipping")
                    continue
                print(f"INDEX    {doc.filename:35.35} status=completed -> ingest existing text")
                await ingest_document_to_rag(doc.id, doc.user_id, text, session)
                await session.commit()

            new_chunks = await _chunk_count(session, doc.id)
            print(f"         -> {new_chunks} chunks now present\n")

    # Final summary
    async with AsyncSessionLocal() as session:
        total_chunks = await session.scalar(select(func.count()).select_from(DocumentChunk))
        status_rows = (
            await session.execute(select(Document.status, func.count()).group_by(Document.status))
        ).all()
        print("\n=== FINAL STATE ===")
        print("document_chunks total:", total_chunks)
        for s, c in status_rows:
            print(f"  {s}: {c}")


if __name__ == "__main__":
    asyncio.run(main())

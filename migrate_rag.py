"""
One-shot migration: enables pgvector and creates the document_chunks table.
Run once:  python migrate_rag.py
"""

import asyncio

from sqlalchemy import text

from models.database import async_engine, Base
# Ensure DocumentChunk is imported and registered on Base.metadata
import models.database
import models.user  # Ensure 'users' table is registered for foreign key constraint


async def run_migration():
    async with async_engine.begin() as conn:
        print("Enabling pgvector extension if not exists...")
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    print("Creating DocumentChunk table...")
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    print("Migration successful! RAG tables are ready.")


if __name__ == "__main__":
    asyncio.run(run_migration())

"""
One-shot migration: adds session_version column to the existing 'users' table.
Run once:  python migrate_session_version.py
"""

import asyncio

from sqlalchemy import text

from models.database import async_engine


async def run_migration():
    async with async_engine.begin() as conn:
        # Check if the column already exists (idempotent)
        res = await conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name='users' AND column_name='session_version'"
            )
        )
        if res.scalar():
            print("session_version column already exists — nothing to do.")
            return

        print("Adding session_version column to users table...")
        await conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1"
            )
        )
        print("Migration successful!")


if __name__ == "__main__":
    asyncio.run(run_migration())

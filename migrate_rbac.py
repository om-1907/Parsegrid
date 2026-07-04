"""
One-shot migration: adds role column to users table for RBAC.
Run once:  python migrate_rbac.py
"""

import asyncio

from sqlalchemy import text

from models.database import async_engine


async def run_migration():
    async with async_engine.begin() as conn:
        print("Adding 'role' column to 'users' table...")
        
        # We need to check if the column exists first, similar to how we handled session_version.
        check_stmt = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='role';
        """)
        
        result = await conn.execute(check_stmt)
        if result.scalar() is None:
            await conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'Analyst' NOT NULL"))
            print("'role' column added successfully.")
        else:
            print("'role' column already exists.")

    print("Migration successful! RBAC is ready.")


if __name__ == "__main__":
    asyncio.run(run_migration())

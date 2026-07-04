import asyncio
from sqlalchemy import text
from models.database import async_engine

async def run_migration():
    async with async_engine.begin() as conn:
        print("Fetching first user...")
        res = await conn.execute(text("SELECT id FROM users ORDER BY created_at ASC LIMIT 1"))
        first_user = res.scalar()
        
        print("Checking if user_id exists in documents...")
        res = await conn.execute(text("SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='user_id'"))
        exists = res.scalar()
        if exists:
            print("user_id already exists!")
            return
            
        print("Adding user_id column to documents...")
        try:
            if first_user:
                print(f"Setting default user to {first_user}")
                await conn.execute(text(f"ALTER TABLE documents ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE DEFAULT '{first_user}'"))
                # Then drop the default so future inserts don't use it automatically
                await conn.execute(text("ALTER TABLE documents ALTER COLUMN user_id DROP DEFAULT"))
            else:
                print("No users found. Adding nullable=True first then changing to False.")
                await conn.execute(text("ALTER TABLE documents ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE"))
            print("Migration successful!")
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    asyncio.run(run_migration())

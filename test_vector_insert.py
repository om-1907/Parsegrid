import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from config import settings
from models.database import DocumentChunk
from pgvector.sqlalchemy import Vector

async def test_insert():
    engine = create_async_engine(settings.database_url)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    
    async with SessionLocal() as session:
        # Create a dummy 3072 dim vector
        vec = [0.1] * 3072
        doc_id = uuid.uuid4()
        user_id = uuid.uuid4()
        
        chunk = DocumentChunk(
            document_id=doc_id,
            user_id=user_id,
            chunk_text="test chunk",
            embedding=vec
        )
        session.add(chunk)
        try:
            await session.commit()
            print("INSERT SUCCESS")
        except Exception as e:
            print(f"INSERT FAILED: {e}")
            await session.rollback()

asyncio.run(test_insert())

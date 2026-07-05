"""Quick test: which Gemini embedding model works with the current LiteLLM version."""
import asyncio
import litellm
import os
import sys

# Add the project root to sys.path so config is found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import settings

async def main():
    print(f"Testing embedding model: {settings.embedding_model}")
    print(f"Dimensions: {settings.embedding_dimensions}")
    
    keys = settings.get_api_keys
    response = None
    
    for idx, key in enumerate(keys):
        try:
            response = await litellm.aembedding(
                model=settings.embedding_model,
                input="This is a test of the embedding model.",
                api_key=key,
                dimensions=settings.embedding_dimensions,
            )
            break
        except litellm.exceptions.RateLimitError as e:
            if idx == len(keys) - 1:
                raise e
    
    embedding = response.data[0].embedding
    print(f"Embedding length: {len(embedding)}")
    print(f"First 5 values: {embedding[:5]}")

if __name__ == "__main__":
    asyncio.run(main())

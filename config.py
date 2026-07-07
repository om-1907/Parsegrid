import os
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Placeholder values that MUST be replaced before production launch.
_UNSAFE_JWT_PLACEHOLDERS = {
    "change-me-generate-a-long-random-string",
    "your-secret-key",
    "secret",
    "changeme",
}


class Settings(BaseSettings):
    """
    Application configuration settings using Pydantic Settings v2.
    Loads safely from environment variables and an optional .env file.
    """
    # Use SettingsConfigDict for Pydantic v2 configurations
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Securely load the required credentials
    gemini_api_keys: str = Field(default="", description="Comma-separated list of API keys for Gemini LLM to handle rate limits")
    gemini_api_key: str = Field(default="", description="Legacy single API key for Gemini LLM")
    database_url: str = Field(..., description="Async connection string for PostgreSQL")
    jwt_secret_key: str = Field(..., description="Secret used to sign JWT access tokens")

    @property
    def get_api_keys(self) -> list[str]:
        """Returns a list of all configured API keys."""
        keys = [k.strip() for k in self.gemini_api_keys.split(",") if k.strip()]
        if not keys and self.gemini_api_key.strip():
            keys = [self.gemini_api_key.strip()]
        if not keys:
            raise ValueError("No Gemini API keys provided. Set GEMINI_API_KEYS in .env")
        return keys

    @property
    def get_cors_origins(self) -> list[str]:
        """Parsed list of browser origins allowed by CORS (from the comma-separated setting)."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # LiteLLM model identifiers. Kept configurable so extraction / RAG synthesis
    # can be pointed at a different model without code changes.
    llm_model: str = Field(default="gemini/gemini-2.5-flash", description="Chat model for extraction & RAG synthesis")
    embedding_model: str = Field(default="gemini/gemini-embedding-001", description="Embedding model for RAG vector search")
    # gemini-embedding-001 returns 3072 dims by default, but the document_chunks
    # column is vector(768) (and pgvector HNSW indexes cap at 2000 dims). We request
    # a 768-dim (Matryoshka) embedding so ingestion + query dims match the column.
    # This MUST equal the vector() size of document_chunks.embedding in the DB.
    embedding_dimensions: int = Field(default=768, description="Vector size for embeddings; must match the document_chunks.embedding column")

    # Application settings
    environment: str = Field(default="development", alias="ENVIRONMENT")
    debug: bool = Field(default=False, alias="DEBUG")

    # Comma-separated list of browser Origins allowed to call this API (CORS).
    # The frontend runs on a different origin in production (e.g. Vercel), so its
    # URL MUST be listed here or the browser blocks every request. In production
    # set CORS_ORIGINS to your deployed frontend URL(s), e.g.
    # "https://your-app.vercel.app" (multiple separated by commas). Defaults to
    # the local Next.js dev server. Parsed via the `get_cors_origins` property.
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        description="Comma-separated browser origins allowed by CORS",
        alias="CORS_ORIGINS",
    )

    # Caps how many document-extraction pipelines run concurrently. Each pipeline
    # holds a DB connection and makes LLM/embedding API calls, so an unbounded
    # batch upload would exhaust the connection pool and hit provider rate limits.
    # A global asyncio.Semaphore in services/worker.py enforces this ceiling.
    # Default of 3 is tuned for a small pool of free-tier Gemini keys: a live
    # 20-doc batch test showed concurrency=5 outran the free-tier requests/minute
    # quota (~40% of docs hit "rate limit exceeded on all keys" despite the
    # extractor's 3x backoff retry). Lower concurrency spreads LLM calls over more
    # time, letting the retry/backoff actually recover. Raise it with more keys or
    # a paid tier.
    extraction_concurrency: int = Field(
        default=3,
        ge=1,
        description="Max number of document extraction pipelines allowed to run simultaneously",
        alias="EXTRACTION_CONCURRENCY",
    )

    # SQLAlchemy connection-pool sizing. CRITICAL: pool_size + max_overflow must
    # stay UNDER the Supabase pooler's client limit (session mode caps at 15 on
    # the default plan). Exceeding it makes Supabase reject connections with
    # "EMAXCONNSESSION max clients reached", which strands in-flight documents in
    # 'pending'/'failed' under batch load. Default total = 8 + 4 = 12 (headroom < 15).
    db_pool_size: int = Field(
        default=8, ge=1, description="Baseline persistent DB connections", alias="DB_POOL_SIZE"
    )
    db_max_overflow: int = Field(
        default=4, ge=0, description="Extra DB connections allowed during spikes", alias="DB_MAX_OVERFLOW"
    )

    # When True, the DB connection stays TLS-encrypted but skips CA/hostname
    # verification. Needed for local dev against the Supabase pooler (private CA)
    # or behind TLS-intercepting antivirus/proxies. Leave False in production.
    db_ssl_insecure: bool = Field(default=False, alias="DB_SSL_INSECURE")

    @model_validator(mode="after")
    def _validate_security_invariants(self) -> "Settings":
        """Hard startup guard: reject insecure JWT secrets."""
        key = self.jwt_secret_key.strip()
        if key.lower() in _UNSAFE_JWT_PLACEHOLDERS:
            raise ValueError(
                "FATAL: JWT_SECRET_KEY is set to an unsafe placeholder value. "
                "Generate a strong random key with: "
                "python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        if len(key) < 32:
            raise ValueError(
                f"FATAL: JWT_SECRET_KEY is only {len(key)} characters. "
                "It must be at least 32 characters for production security."
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def async_database_url(self) -> str:
        """Alias for compatibility with models/database.py"""
        return self.database_url


# Instantiate a singleton settings object
settings = Settings()

import os
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    gemini_api_key: str = Field(..., description="API key for Gemini LLM")
    database_url: str = Field(..., description="Async connection string for PostgreSQL")
    jwt_secret_key: str = Field(..., description="Secret used to sign JWT access tokens")

    # LiteLLM model identifiers. Kept configurable so extraction / RAG synthesis
    # can be pointed at a different model without code changes.
    llm_model: str = Field(default="gemini/gemini-2.5-flash", description="Chat model for extraction & RAG synthesis")
    embedding_model: str = Field(default="gemini/text-embedding-004", description="Embedding model for RAG vector search")

    # Application settings
    environment: str = Field(default="development", alias="ENVIRONMENT")
    debug: bool = Field(default=False, alias="DEBUG")

    # When True, the DB connection stays TLS-encrypted but skips CA/hostname
    # verification. Needed for local dev against the Supabase pooler (private CA)
    # or behind TLS-intercepting antivirus/proxies. Leave False in production.
    db_ssl_insecure: bool = Field(default=False, alias="DB_SSL_INSECURE")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def async_database_url(self) -> str:
        """Alias for compatibility with models/database.py"""
        return self.database_url


# Instantiate a singleton settings object
settings = Settings()

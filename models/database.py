import uuid
from datetime import datetime
from typing import Any, Dict, Optional
import enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    Uuid,
    func,
    Enum,
    JSON
)
from sqlalchemy.ext.asyncio import (
    AsyncAttrs,
    AsyncSession,
    async_sessionmaker,
    create_async_engine
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship
)

from config import settings


class DocumentType(enum.Enum):
    contract = "contract"
    resume = "resume"


class Base(AsyncAttrs, DeclarativeBase):
    """Base class for SQLAlchemy 2.0 declarative models with async support."""
    pass


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    
    document_type: Mapped[DocumentType] = mapped_column(Enum(DocumentType), nullable=False, default=DocumentType.contract)
    original_language: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    parent_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    
    upload_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="PENDING")
    
    # Relationships
    extracted_data: Mapped[Optional["ExtractedData"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        uselist=False
    )
    extracted_resume: Mapped[Optional["ExtractedResume"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        uselist=False
    )

    __table_args__ = (
        Index("ix_documents_file_hash", "file_hash"),
        Index("ix_documents_user_id", "user_id"),
        Index("ix_documents_status", "status"),
    )


class ExtractedData(Base):
    __tablename__ = "extracted_data"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False
    )
    party_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contract_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    contract_value_original: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    contract_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    exchange_rate_to_inr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    exchange_rate_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    payment_terms_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    penalty_clause_exists: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    governing_law: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    needs_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Per-field extraction confidence (field -> 0..1) and verbatim source quotes
    # (field -> sentence). Stored as JSON so the UI can render confidence bars and
    # citations without extra columns per field.
    confidence: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    source_quotes: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    document: Mapped["Document"] = relationship(back_populates="extracted_data")

    __table_args__ = (
        Index("ix_extracted_data_document_id", "document_id"),
        Index("ix_extracted_data_payment_terms_days", "payment_terms_days"),
        Index("ix_extracted_data_needs_review", "needs_review"),
        Index("ix_extracted_data_governing_law", "governing_law"),
        Index("ix_extracted_data_contract_value", "contract_value"),
        Index("ix_extracted_data_party_name", "party_name"),
    )


class ExtractedResume(Base):
    __tablename__ = "extracted_resumes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False
    )
    candidate_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    years_of_experience: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    education_level: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    skills: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    previous_companies: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    needs_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Per-field extraction confidence (field -> 0..1) and verbatim source quotes.
    confidence: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    source_quotes: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    document: Mapped["Document"] = relationship(back_populates="extracted_resume")

    __table_args__ = (
        Index("ix_extracted_resumes_document_id", "document_id"),
        Index("ix_extracted_resumes_needs_review", "needs_review"),
    )


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doc_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    input_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    output_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False
    )

    __table_args__ = (
        Index("ix_audit_log_doc_id", "doc_id"),
        Index("ix_audit_log_event_type", "event_type"),
    )


from pgvector.sqlalchemy import Vector

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), 
        nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False
    )
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    # Must match settings.embedding_dimensions and the live vector() column size.
    # Kept at 768 so the HNSW cosine index stays valid (pgvector HNSW caps at 2000 dims).
    embedding: Mapped[Any] = mapped_column(Vector(settings.embedding_dimensions), nullable=False)

    __table_args__ = (
        Index(
            "ix_document_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("ix_document_chunks_user_id", "user_id"),
        Index("ix_document_chunks_document_id", "document_id"),
    )


# Database Engine and Session Factory Setup
import ssl

import certifi

connect_args = {}
if "supabase.co" in settings.async_database_url or "supabase.com" in settings.async_database_url:
    # Verify the server certificate against a trusted CA bundle instead of
    # disabling verification. certifi ships an up-to-date root store.
    ssl_context = ssl.create_default_context(cafile=certifi.where())
    if settings.db_ssl_insecure:
        # Local-dev escape hatch: keep the channel encrypted but don't verify the
        # chain. Required for the Supabase pooler's private CA / TLS interception.
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
    connect_args["ssl"] = ssl_context

async_engine = create_async_engine(
    settings.async_database_url,
    echo=settings.debug,
    future=True,
    connect_args=connect_args,
    # ── Production Connection Pool Configuration ──────────────────────────
    # pool_size: Baseline persistent connections held open to Supabase.
    # max_overflow: Extra connections allowed during traffic spikes.
    # CRITICAL: pool_size + max_overflow MUST stay under the Supabase pooler's
    #   client limit (session mode caps at 15 on the default plan). Exceeding it
    #   makes the pooler reject new connections with "EMAXCONNSESSION max clients
    #   reached", which strands documents in 'pending'/'failed' under batch load.
    #   Both values are env-tunable (DB_POOL_SIZE / DB_MAX_OVERFLOW) so they can be
    #   raised if you move to transaction mode or a larger plan.
    # pool_timeout: Seconds to wait for a free connection before raising an error.
    # pool_pre_ping: Liveness check; transparently reconnects stale connections.
    # pool_recycle: Proactively retire connections older than 5 min (Supavisor compat).
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=30,
    pool_pre_ping=True,
    pool_recycle=300,
)

# NOTE: Do NOT register the asyncpg-level pgvector codec (pgvector.asyncpg.register_vector)
# here. The `pgvector.sqlalchemy.Vector` column type already handles encoding/decoding via
# SQLAlchemy's bind/result processors. Registering both makes SQLAlchemy stringify the
# embedding list AND the asyncpg codec re-encode that string, raising
# "invalid input for query argument ... '[0.01, ...]'" on every insert/search.

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

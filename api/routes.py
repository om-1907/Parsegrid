import asyncio
import logging
import os
import uuid
import zipfile
import io
from datetime import datetime
from typing import AsyncGenerator, List, Optional, Union

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user, require_role
from models.database import AsyncSessionLocal, Document, DocumentType, ExtractedData
from models.user import User
from models.schemas import GlobalSearchRequest, GlobalSearchResponse
from services.pdf_reader import generate_file_hash
from services.worker import process_document_pipeline
from services.audit import write_audit_entry
from services.rag_engine import secure_global_search
from services.currency import convert_to_inr, normalize_currency_code
from middleware.rate_limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Documents"])

STORAGE_DIR = "./storage"
os.makedirs(STORAGE_DIR, exist_ok=True)

# Maximum accepted upload size (25 MB) to protect the server from OOM.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

# ZIP-bomb defenses: cap how many inner files we extract and the total
# uncompressed bytes we will read out of a single archive. Without these, a
# small malicious .zip can decompress to gigabytes and OOM the server.
MAX_ZIP_ENTRIES = 200
MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 200 * 1024 * 1024  # 200 MB


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI Dependency that cleanly manages the SQLAlchemy async session lifecycle.
    """
    async with AsyncSessionLocal() as session:
        yield session


def _write_file(file_path: str, data: bytes) -> None:
    """Synchronous disk write, intended to be run via asyncio.to_thread."""
    with open(file_path, "wb") as f:
        f.write(data)


async def background_process_document(doc_id: uuid.UUID, file_path: str):
    """
    Wrapper function explicitly instantiated to give the background task its own isolated database session.
    FastAPI immediately closes request-bound DB sessions (via Depends) right after the API response is sent.
    """
    async with AsyncSessionLocal() as session:
        await process_document_pipeline(doc_id=doc_id, file_path=file_path, db_session=session)


# --- Request and Response Schemas ---

class DocumentResponse(BaseModel):
    id: uuid.UUID
    filename: str
    status: str
    message: Optional[str] = None

class BatchDocumentResponse(BaseModel):
    ids: List[uuid.UUID]
    message: str
    skipped: int = 0
    errors: List[str] = Field(default_factory=list)

class DocumentStatusResponse(BaseModel):
    id: uuid.UUID
    status: str

class ExtractedDataResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    party_name: Optional[str] = None
    contract_value: Optional[float] = None
    contract_value_original: Optional[float] = None
    contract_currency: str = "INR"
    exchange_rate_to_inr: Optional[float] = None
    exchange_rate_date: Optional[str] = None
    payment_terms_days: Optional[int] = None
    penalty_clause_exists: Optional[bool] = None
    governing_law: Optional[str] = None
    needs_review: bool
    filename: Optional[str] = None
    upload_time: Optional[datetime] = None
    # Per-field confidence map (field -> 0..1) + flattened source quotes the UI renders.
    confidence: dict = Field(default_factory=dict)
    party_name_source_quote: Optional[str] = None
    contract_value_source_quote: Optional[str] = None
    payment_terms_days_source_quote: Optional[str] = None
    penalty_clause_exists_source_quote: Optional[str] = None
    governing_law_source_quote: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ExtractedDataUpdateRequest(BaseModel):
    party_name: Optional[str] = Field(default=None, max_length=500)
    contract_value: Optional[float] = Field(default=None, ge=0.0, le=1e15)
    contract_currency: Optional[str] = Field(default="INR", min_length=3, max_length=3)
    payment_terms_days: Optional[int] = Field(default=None, ge=0, le=3650)
    penalty_clause_exists: Optional[bool] = None
    governing_law: Optional[str] = Field(default=None, max_length=200)


class ExtractedResumeResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    candidate_name: Optional[str] = None
    years_of_experience: Optional[float] = None
    education_level: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    previous_companies: List[str] = Field(default_factory=list)
    needs_review: bool
    filename: Optional[str] = None
    upload_time: Optional[datetime] = None
    confidence: dict = Field(default_factory=dict)
    candidate_name_source_quote: Optional[str] = None
    years_of_experience_source_quote: Optional[str] = None
    education_level_source_quote: Optional[str] = None
    skills_source_quote: Optional[str] = None
    previous_companies_source_quote: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ExtractedResumeUpdateRequest(BaseModel):
    candidate_name: Optional[str] = Field(default=None, max_length=500)
    years_of_experience: Optional[float] = Field(default=None, ge=0.0)
    education_level: Optional[str] = Field(default=None, max_length=200)
    skills: Optional[List[str]] = None
    previous_companies: Optional[List[str]] = None




# ── In-Memory TTL Cache for /status endpoint ─────────────────────────────
import time as _time
_status_cache: dict[str, tuple[float, dict]] = {}  # key → (expiry_ts, payload)
_STATUS_CACHE_TTL = 3  # seconds
_STATUS_CACHE_MAX = 10_000  # hard cap so the cache can't grow unbounded


def _status_cache_set(key: str, payload: dict) -> None:
    """Store a status payload, evicting expired entries and capping total size
    so many distinct documents can't leak memory in a long-running process."""
    now = _time.time()
    if len(_status_cache) >= _STATUS_CACHE_MAX:
        expired = [k for k, (exp, _) in _status_cache.items() if exp <= now]
        for k in expired:
            _status_cache.pop(k, None)
        # Still full of live entries → drop the oldest to make room.
        if len(_status_cache) >= _STATUS_CACHE_MAX:
            oldest = sorted(_status_cache.items(), key=lambda kv: kv[1][0])[: _STATUS_CACHE_MAX // 10]
            for k, _ in oldest:
                _status_cache.pop(k, None)
    _status_cache[key] = (now + _STATUS_CACHE_TTL, payload)


# --- Endpoints ---

# File types accepted directly and inside ZIP archives.
INNER_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".csv", ".html", ".htm"}
ALLOWED_EXTENSIONS = INNER_ALLOWED_EXTENSIONS | {".zip"}


@router.post("/upload", response_model=BatchDocumentResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("10/minute")
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    document_type: str = Form(default="contract"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads one or more documents (and/or ZIP archives containing many documents) in a
    single request. Each file is de-duplicated by SHA-256 (per user, and within the same
    batch); novel files are saved to storage and queued for async extraction.

    The `document_type` acts as a preset — the background pipeline may auto-correct it based
    on the file's actual content (see services/worker.py).

    Always returns a BatchDocumentResponse: the ids queued, a count of skipped duplicates,
    and any per-file errors (so one bad file never fails the whole batch).
    """
    try:
        doc_type_enum = DocumentType(document_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document_type. Must be 'contract' or 'resume'.")

    if not files:
        raise HTTPException(status_code=400, detail="No files were uploaded.")

    queued_ids: List[uuid.UUID] = []
    skipped = 0
    errors: List[str] = []
    seen_hashes: set[str] = set()  # in-batch dedup (session isn't flushed until the end)

    async def _ingest(file_bytes: bytes, original_filename: str, ext: str) -> str:
        """Save + queue a single document. Returns 'queued' or 'skipped'."""
        nonlocal skipped
        # SHA-256 over up to 25 MB is CPU-bound; run it off the event loop so a
        # large batch doesn't freeze the server for every other request.
        file_hash = await asyncio.to_thread(generate_file_hash, file_bytes)

        # Duplicate within this same batch?
        if file_hash in seen_hashes:
            skipped += 1
            return "skipped"

        # Duplicate already in the DB for this user?
        stmt = select(Document).where(Document.file_hash == file_hash, Document.user_id == current_user.id)
        if (await db.execute(stmt)).scalar_one_or_none():
            skipped += 1
            return "skipped"

        seen_hashes.add(file_hash)
        doc_id = uuid.uuid4()
        file_path = os.path.join(STORAGE_DIR, f"{doc_id}{ext}")
        # Blocking disk write also moved off the event loop.
        await asyncio.to_thread(_write_file, file_path, file_bytes)

        db.add(Document(
            id=doc_id,
            user_id=current_user.id,
            filename=original_filename,
            file_hash=file_hash,
            status="pending",
            document_type=doc_type_enum,
        ))
        queued_ids.append(doc_id)
        background_tasks.add_task(background_process_document, doc_id, file_path)
        return "queued"

    for upload in files:
        if not upload.filename:
            errors.append("A file was missing its filename.")
            continue

        _, ext = os.path.splitext(upload.filename.lower())
        if ext not in ALLOWED_EXTENSIONS:
            errors.append(f"{upload.filename}: unsupported file type.")
            continue

        file_bytes = await upload.read()
        if len(file_bytes) > MAX_UPLOAD_BYTES:
            errors.append(f"{upload.filename}: exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.")
            continue
        if not file_bytes:
            errors.append(f"{upload.filename}: file is empty.")
            continue

        if ext == ".zip":
            try:
                entries_processed = 0
                total_uncompressed = 0
                with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                    for zip_info in z.infolist():
                        if zip_info.is_dir():
                            continue
                        # Skip macOS metadata and dotfiles.
                        if zip_info.filename.startswith("__MACOSX/") or zip_info.filename.split("/")[-1].startswith("."):
                            continue
                        _, z_ext = os.path.splitext(zip_info.filename.lower())
                        if z_ext not in INNER_ALLOWED_EXTENSIONS:
                            continue

                        # ── ZIP-bomb guards (check BEFORE decompressing) ──
                        if entries_processed >= MAX_ZIP_ENTRIES:
                            errors.append(f"{upload.filename}: archive has more than {MAX_ZIP_ENTRIES} files; the rest were skipped.")
                            break
                        # zip_info.file_size is the declared uncompressed size from
                        # the header — reject oversized/bomb entries without reading them.
                        if zip_info.file_size > MAX_UPLOAD_BYTES:
                            errors.append(f"{zip_info.filename}: exceeds the size limit.")
                            continue
                        if total_uncompressed + zip_info.file_size > MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES:
                            errors.append(f"{upload.filename}: total uncompressed size exceeds the {MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES // (1024*1024)} MB limit; remaining files skipped.")
                            break
                        entries_processed += 1

                        z_bytes = z.read(zip_info.filename)
                        if not z_bytes:
                            continue
                        # Defensive: a lying header could still under-report size.
                        if len(z_bytes) > MAX_UPLOAD_BYTES:
                            errors.append(f"{zip_info.filename}: exceeds the size limit.")
                            continue
                        total_uncompressed += len(z_bytes)
                        try:
                            await _ingest(z_bytes, os.path.basename(zip_info.filename), z_ext)
                        except Exception as e:
                            errors.append(f"{zip_info.filename}: could not be processed.")
            except zipfile.BadZipFile:
                errors.append(f"{upload.filename}: invalid ZIP archive.")
        else:
            try:
                await _ingest(file_bytes, upload.filename, ext)
            except Exception as e:
                logger.warning("Ingest failed for %s: %s", upload.filename, e)
                errors.append(f"{upload.filename}: could not be processed.")

    await db.commit()

    if not queued_ids:
        # Nothing new queued: distinguish "all duplicates" from "all invalid".
        if skipped and not errors:
            raise HTTPException(status_code=409, detail="All uploaded documents already exist.")
        detail = "No valid new documents found."
        if errors:
            detail += " " + " ".join(errors)
        raise HTTPException(status_code=400, detail=detail)

    message = f"Queued {len(queued_ids)} document(s) for extraction."
    if skipped:
        message += f" Skipped {skipped} duplicate(s)."
    if errors:
        message += f" {len(errors)} file(s) could not be processed."
    return BatchDocumentResponse(ids=queued_ids, message=message, skipped=skipped, errors=errors)


@router.get("/documents/{doc_id}/file")
async def get_document_file(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the raw document file.
    """
    stmt = select(Document).where(Document.id == doc_id, Document.user_id == current_user.id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    _, ext = os.path.splitext(doc.filename.lower())
    file_path = os.path.join(STORAGE_DIR, f"{doc_id}{ext}")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File on disk not found.")
    if ext == ".pdf":
        return FileResponse(
            file_path, 
            media_type="application/pdf",
            content_disposition_type="inline",
            filename=doc.filename
        )
    else:
        from fastapi.responses import HTMLResponse
        from services.document_reader import extract_document_text
        import html
        try:
            text = extract_document_text(file_path)
            safe_text = html.escape(text)
            html_content = f"<html><head><style>body {{ font-family: monospace; white-space: pre-wrap; padding: 20px; }}</style></head><body>{safe_text}</body></html>"
            return HTMLResponse(content=html_content)
        except Exception as e:
            logger.warning("Preview generation failed for %s: %s", doc_id, e)
            raise HTTPException(status_code=500, detail="Could not generate document preview.")


@router.get("/status/{doc_id}", response_model=DocumentStatusResponse)
async def get_document_status(
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the current execution state of the document pipeline.
    Results are cached in memory for 3 seconds to reduce DB load from polling.
    """
    cache_key = f"{doc_id}:{current_user.id}"
    now = _time.time()
    cached = _status_cache.get(cache_key)
    if cached and cached[0] > now:
        return DocumentStatusResponse(id=doc_id, status=cached[1]["status"])
    stmt = select(Document).where(Document.id == doc_id, Document.user_id == current_user.id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    payload = {"id": str(doc.id), "status": doc.status}

    # Cache the result for future polls.
    _status_cache_set(cache_key, payload)

    return DocumentStatusResponse(id=doc.id, status=doc.status)


@router.get("/query", response_model=List[ExtractedDataResponse])
async def query_extracted_data(
    min_value: Optional[float] = None,
    max_payment_days: Optional[int] = None,
    requires_review: Optional[bool] = None,
    governing_law: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Constructs a highly optimized async SQLAlchemy query filtering records out of the
    extracted_data table based on parameters passed by the client.

    Paginated (``limit``/``offset``) so a tenant with thousands of documents can't
    force the server to serialize its entire table in one response. The frontend
    currently does client-side search/stats over this page; adopt server-side
    pagination there once a tenant exceeds a few hundred documents.
    """
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    stmt = select(ExtractedData, Document).join(Document, ExtractedData.document_id == Document.id).where(Document.user_id == current_user.id)

    # Dynamically build the filtering clauses
    if min_value is not None:
        stmt = stmt.where(ExtractedData.contract_value >= min_value)

    if max_payment_days is not None:
        stmt = stmt.where(ExtractedData.payment_terms_days <= max_payment_days)

    if requires_review is not None:
        stmt = stmt.where(ExtractedData.needs_review == requires_review)

    if governing_law is not None:
        stmt = stmt.where(ExtractedData.governing_law == governing_law)

    stmt = stmt.order_by(Document.upload_time.desc()).limit(limit).offset(offset)

    # Execute the compound query
    result = await db.execute(stmt)
    rows = result.all()
    
    response = []
    for extracted, document in rows:
        quotes = extracted.source_quotes or {}
        response.append(ExtractedDataResponse(
            id=extracted.id,
            document_id=extracted.document_id,
            party_name=extracted.party_name,
            contract_value=extracted.contract_value,
            contract_value_original=extracted.contract_value_original,
            contract_currency=extracted.contract_currency or "INR",
            exchange_rate_to_inr=extracted.exchange_rate_to_inr,
            exchange_rate_date=extracted.exchange_rate_date,
            payment_terms_days=extracted.payment_terms_days,
            penalty_clause_exists=extracted.penalty_clause_exists,
            governing_law=extracted.governing_law,
            needs_review=extracted.needs_review,
            filename=document.filename,
            upload_time=document.upload_time,
            confidence=extracted.confidence or {},
            party_name_source_quote=quotes.get("party_name"),
            contract_value_source_quote=quotes.get("contract_value"),
            payment_terms_days_source_quote=quotes.get("payment_terms_days"),
            penalty_clause_exists_source_quote=quotes.get("penalty_clause_exists"),
            governing_law_source_quote=quotes.get("governing_law"),
        ))

    return response


@router.patch("/review/{doc_id}", response_model=ExtractedDataResponse)
async def resolve_manual_review(
    doc_id: uuid.UUID,
    update_data: ExtractedDataUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["Manager", "Admin"]))
):
    """
    Resolution endpoint for operators to manually fix extracted field values.
    Updates the extracted_data row, flips needs_review to False, and securely
    logs the manual override in the audit log concurrently.
    """
    stmt = select(ExtractedData).join(Document, ExtractedData.document_id == Document.id).where(ExtractedData.document_id == doc_id, Document.user_id == current_user.id)
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="Extracted data not found for this document.")
        
    # Capture old state for audit compliance
    old_state = {
        "party_name": record.party_name,
        "contract_value": record.contract_value,
        "contract_value_original": record.contract_value_original,
        "contract_currency": record.contract_currency,
        "exchange_rate_to_inr": record.exchange_rate_to_inr,
        "exchange_rate_date": record.exchange_rate_date,
        "payment_terms_days": record.payment_terms_days,
        "penalty_clause_exists": record.penalty_clause_exists,
        "governing_law": record.governing_law,
    }
    
    updates = update_data.model_dump(exclude_unset=True, exclude={"operator_id"})
    if "contract_value" in updates or "contract_currency" in updates:
        original_value = updates.get("contract_value", record.contract_value_original or record.contract_value)
        original_currency = normalize_currency_code(updates.get("contract_currency", record.contract_currency))
        conversion = await convert_to_inr(original_value, original_currency)
        record.contract_value_original = original_value
        record.contract_currency = conversion.currency if conversion else original_currency
        record.contract_value = conversion.amount_inr if conversion else original_value
        record.exchange_rate_to_inr = conversion.rate_to_inr if conversion else None
        record.exchange_rate_date = conversion.rate_date if conversion else None

    for key, value in updates.items():
        if key in {"contract_value", "contract_currency"}:
            continue
        setattr(record, key, value)
        
    # Flip the review flag
    record.needs_review = False
    
    # Commit changes
    await db.commit()
    await db.refresh(record)
    
    # Log the audit event concurrently to prevent blocking the HTTP response
    audit_payload = {
        "old_state": old_state,
        "new_state": updates,
        "operator_id": str(current_user.id)
    }
    
    asyncio.create_task(
        write_audit_entry(
            doc_id=doc_id,
            event_type="manual_override_resolved",
            model_used="human_operator",
            input_text="MANUAL_OVERRIDE",
            output_data=audit_payload,
            db_session=db
        )
    )
    
    return record


@router.get("/query/resumes", response_model=List[ExtractedResumeResponse])
async def query_extracted_resumes(
    min_experience: Optional[float] = None,
    requires_review: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models.database import ExtractedResume
    stmt = select(ExtractedResume, Document).join(Document, ExtractedResume.document_id == Document.id).where(Document.user_id == current_user.id)
    
    if min_experience is not None:
        stmt = stmt.where(ExtractedResume.years_of_experience >= min_experience)
        
    if requires_review is not None:
        stmt = stmt.where(ExtractedResume.needs_review == requires_review)
        
    result = await db.execute(stmt)
    rows = result.all()
    
    response = []
    for extracted, document in rows:
        quotes = extracted.source_quotes or {}
        response.append(ExtractedResumeResponse(
            id=extracted.id,
            document_id=extracted.document_id,
            candidate_name=extracted.candidate_name,
            years_of_experience=extracted.years_of_experience,
            education_level=extracted.education_level,
            skills=extracted.skills,
            previous_companies=extracted.previous_companies,
            needs_review=extracted.needs_review,
            filename=document.filename,
            upload_time=document.upload_time,
            confidence=extracted.confidence or {},
            candidate_name_source_quote=quotes.get("candidate_name"),
            years_of_experience_source_quote=quotes.get("years_of_experience"),
            education_level_source_quote=quotes.get("education_level"),
            skills_source_quote=quotes.get("skills"),
            previous_companies_source_quote=quotes.get("previous_companies"),
        ))

    return response


@router.patch("/review/resume/{doc_id}", response_model=ExtractedResumeResponse)
async def resolve_resume_manual_review(
    doc_id: uuid.UUID,
    update_data: ExtractedResumeUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["manager", "hr_recruiter", "Admin", "Manager"]))
):
    from models.database import ExtractedResume
    stmt = select(ExtractedResume).join(Document, ExtractedResume.document_id == Document.id).where(ExtractedResume.document_id == doc_id, Document.user_id == current_user.id)
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    
    if not record:
        raise HTTPException(status_code=404, detail="Extracted resume not found for this document.")
        
    old_state = {
        "candidate_name": record.candidate_name,
        "years_of_experience": record.years_of_experience,
        "education_level": record.education_level,
        "skills": record.skills,
        "previous_companies": record.previous_companies
    }
    
    updates = update_data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(record, key, value)
        
    record.needs_review = False
    
    await db.commit()
    await db.refresh(record)
    
    audit_payload = {
        "old_state": old_state,
        "new_state": updates,
        "operator_id": str(current_user.id)
    }
    
    asyncio.create_task(
        write_audit_entry(
            doc_id=doc_id,
            event_type="resume_manual_override_resolved",
            model_used="human_operator",
            input_text="MANUAL_OVERRIDE",
            output_data=audit_payload,
            db_session=db
        )
    )
    
    return record


@router.post("/global-search", response_model=GlobalSearchResponse)
@limiter.limit("20/minute")
async def global_search(
    request: Request,
    body: GlobalSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Performs a secure, tenant-isolated vector search across all documents owned by the user.
    Answers the query using LLM synthesis with strict prompt injection defenses.
    """
    try:
        scope = DocumentType(body.document_type) if body.document_type else None
        response = await secure_global_search(body.query, current_user.id, db, document_type=scope)
        return response
    except Exception as e:
        logger.error("Global search failed for user %s: %s", current_user.id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Search failed. Please try again.")


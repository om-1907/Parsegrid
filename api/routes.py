import asyncio
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
from middleware.rate_limiter import limiter

router = APIRouter(prefix="/api/v1", tags=["Documents"])

STORAGE_DIR = "./storage"
os.makedirs(STORAGE_DIR, exist_ok=True)

# Maximum accepted upload size (25 MB) to protect the server from OOM.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI Dependency that cleanly manages the SQLAlchemy async session lifecycle.
    """
    async with AsyncSessionLocal() as session:
        yield session


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

class DocumentStatusResponse(BaseModel):
    id: uuid.UUID
    status: str

class ExtractedDataResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    party_name: Optional[str] = None
    contract_value: Optional[float] = None
    payment_terms_days: Optional[int] = None
    penalty_clause_exists: Optional[bool] = None
    governing_law: Optional[str] = None
    needs_review: bool
    filename: Optional[str] = None
    upload_time: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ExtractedDataUpdateRequest(BaseModel):
    party_name: Optional[str] = Field(default=None, max_length=500)
    contract_value: Optional[float] = Field(default=None, ge=0.0, le=1e15)
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


# --- Endpoints ---

@router.post("/upload", response_model=Union[DocumentResponse, BatchDocumentResponse], status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("10/minute")
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_type: str = Form(default="contract"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads a PDF document or a ZIP archive containing multiple documents.
    Checks for duplicates using SHA256. If valid and novel, saves to storage
    and triggers the extraction pipeline asynchronously.
    """
    try:
        doc_type_enum = DocumentType(document_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid document_type. Must be 'contract' or 'resume'.")

    allowed_extensions = {".pdf", ".docx", ".txt", ".md", ".csv", ".html", ".htm", ".zip"}
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is missing.")
        
    _, ext = os.path.splitext(file.filename.lower())
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Supported formats are: {', '.join(allowed_extensions)}"
        )
        
    file_bytes = await file.read()

    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum allowed size of {MAX_UPLOAD_BYTES // (1024 * 1024)} MB."
        )
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if ext == ".zip":
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                queued_ids = []
                for zip_info in z.infolist():
                    if zip_info.is_dir(): continue
                    # Skip hidden files
                    if zip_info.filename.startswith("__MACOSX/") or zip_info.filename.split("/")[-1].startswith("."):
                        continue
                    _, z_ext = os.path.splitext(zip_info.filename.lower())
                    if z_ext not in {".pdf", ".docx", ".txt", ".md", ".csv", ".html", ".htm"}:
                        continue
                        
                    z_file_bytes = z.read(zip_info.filename)
                    if not z_file_bytes: continue
                    
                    z_file_hash = generate_file_hash(z_file_bytes)
                    
                    # Check if exists
                    stmt = select(Document).where(Document.file_hash == z_file_hash, Document.user_id == current_user.id)
                    result = await db.execute(stmt)
                    if result.scalar_one_or_none():
                        continue # Skip existing documents in batch
                        
                    z_doc_id = uuid.uuid4()
                    z_unique_filename = f"{z_doc_id}{z_ext}"
                    z_file_path = os.path.join(STORAGE_DIR, z_unique_filename)
                    
                    with open(z_file_path, "wb") as f:
                        f.write(z_file_bytes)
                        
                    new_doc = Document(
                        id=z_doc_id,
                        user_id=current_user.id,
                        filename=os.path.basename(zip_info.filename),
                        file_hash=z_file_hash,
                        status="pending",
                        document_type=doc_type_enum
                    )
                    db.add(new_doc)
                    queued_ids.append(z_doc_id)
                    background_tasks.add_task(background_process_document, z_doc_id, z_file_path)
                    
                await db.commit()
                if not queued_ids:
                    raise HTTPException(status_code=400, detail="No valid novel documents found in the ZIP archive.")
                return BatchDocumentResponse(ids=queued_ids, message=f"Queued {len(queued_ids)} documents.")
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid ZIP archive.")

    try:
        file_hash = generate_file_hash(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to generate file hash: {e}")
        
    # Check if a document with this exact file_hash already exists for this user
    stmt = select(Document).where(Document.file_hash == file_hash, Document.user_id == current_user.id)
    result = await db.execute(stmt)
    existing_doc = result.scalar_one_or_none()
    
    if existing_doc:
        # Return 200 immediately to save processing and API costs
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "id": str(existing_doc.id),
                "filename": existing_doc.filename,
                "status": existing_doc.status,
                "message": "Document already exists. Returning cached processing state."
            }
        )
        
    # Novel document flow
    doc_id = uuid.uuid4()
    unique_filename = f"{doc_id}{ext}"
    file_path = os.path.join(STORAGE_DIR, unique_filename)
    
    # Save the binary to the storage directory
    with open(file_path, "wb") as f:
        f.write(file_bytes)
        
    # Insert new record into the documents table
    new_doc = Document(
        id=doc_id,
        user_id=current_user.id,
        filename=file.filename,
        file_hash=file_hash,
        status="pending",
        document_type=doc_type_enum
    )
    db.add(new_doc)
    await db.commit()
    
    # Trigger process_document_pipeline in the background
    background_tasks.add_task(background_process_document, doc_id, file_path)
    
    return DocumentResponse(
        id=doc_id,
        filename=file.filename,
        status="pending",
        message="Document uploaded successfully and queued for processing."
    )


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
            raise HTTPException(status_code=500, detail=f"Could not generate preview: {e}")


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
    _status_cache[cache_key] = (_time.time() + _STATUS_CACHE_TTL, payload)

    return DocumentStatusResponse(id=doc.id, status=doc.status)


@router.get("/query", response_model=List[ExtractedDataResponse])
async def query_extracted_data(
    min_value: Optional[float] = None,
    max_payment_days: Optional[int] = None,
    requires_review: Optional[bool] = None,
    governing_law: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Constructs a highly optimized async SQLAlchemy query filtering records out of the 
    extracted_data table based on parameters passed by the client.
    """
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
        
    # Execute the compound query
    result = await db.execute(stmt)
    rows = result.all()
    
    response = []
    for extracted, document in rows:
        response.append(ExtractedDataResponse(
            id=extracted.id,
            document_id=extracted.document_id,
            party_name=extracted.party_name,
            contract_value=extracted.contract_value,
            payment_terms_days=extracted.payment_terms_days,
            penalty_clause_exists=extracted.penalty_clause_exists,
            governing_law=extracted.governing_law,
            needs_review=extracted.needs_review,
            filename=document.filename,
            upload_time=document.upload_time
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
        "payment_terms_days": record.payment_terms_days,
        "penalty_clause_exists": record.penalty_clause_exists,
        "governing_law": record.governing_law,
    }
    
    # Apply precise dictionary updates
    updates = update_data.model_dump(exclude_unset=True, exclude={"operator_id"})
    for key, value in updates.items():
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
            upload_time=document.upload_time
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
        response = await secure_global_search(body.query, current_user.id, db)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")


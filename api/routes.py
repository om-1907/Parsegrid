import asyncio
import os
import uuid
from datetime import datetime
from typing import AsyncGenerator, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user
from models.database import AsyncSessionLocal, Document, ExtractedData
from models.user import User
from services.pdf_reader import generate_file_hash
from services.worker import process_document_pipeline
from services.audit import write_audit_entry

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
    party_name: Optional[str] = None
    contract_value: Optional[float] = None
    payment_terms_days: Optional[int] = None
    penalty_clause_exists: Optional[bool] = None
    governing_law: Optional[str] = None
    operator_id: str = "system_operator"


# --- Endpoints ---

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads a PDF document. Checks for duplicates using SHA256. If valid and novel, saves to storage
    and triggers the extraction pipeline asynchronously.
    """
    allowed_extensions = {".pdf", ".docx", ".txt", ".md", ".csv", ".html", ".htm"}
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

    try:
        file_hash = generate_file_hash(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to generate file hash: {e}")
        
    # Check if a document with this exact file_hash already exists
    stmt = select(Document).where(Document.file_hash == file_hash)
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
        filename=file.filename,
        file_hash=file_hash,
        status="pending"
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
    stmt = select(Document).where(Document.id == doc_id)
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
    """
    stmt = select(Document).where(Document.id == doc_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    return DocumentStatusResponse(id=doc.id, status=doc.status)


@router.get("/query", response_model=List[ExtractedDataResponse])
async def query_extracted_data(
    min_value: Optional[float] = None,
    max_payment_days: Optional[int] = None,
    requires_review: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Constructs a highly optimized async SQLAlchemy query filtering records out of the 
    extracted_data table based on parameters passed by the client.
    """
    stmt = select(ExtractedData, Document).join(Document, ExtractedData.document_id == Document.id)
    
    # Dynamically build the filtering clauses
    if min_value is not None:
        stmt = stmt.where(ExtractedData.contract_value >= min_value)
    
    if max_payment_days is not None:
        stmt = stmt.where(ExtractedData.payment_terms_days <= max_payment_days)
        
    if requires_review is not None:
        stmt = stmt.where(ExtractedData.needs_review == requires_review)
        
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
    current_user: User = Depends(get_current_user)
):
    """
    Resolution endpoint for operators to manually fix extracted field values.
    Updates the extracted_data row, flips needs_review to False, and securely
    logs the manual override in the audit log concurrently.
    """
    stmt = select(ExtractedData).where(ExtractedData.document_id == doc_id)
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
        "operator_id": update_data.operator_id
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

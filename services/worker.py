import asyncio
import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import Document, ExtractedData
from services.llm_extractor import (
    LLMExtractionError,
    classify_document_type,
    run_structured_extraction,
)
from services.document_reader import DocumentReaderError, extract_document_text

# Configure a module-level logger
logger = logging.getLogger(__name__)


async def _set_document_status(doc_id: UUID, status: str, db_session: AsyncSession) -> Optional[Document]:
    """
    Helper function to safely update the status of a document with explicit commit management.
    """
    try:
        stmt = select(Document).where(Document.id == doc_id)
        result = await db_session.execute(stmt)
        document = result.scalar_one_or_none()
        
        if not document:
            logger.error(f"Document with ID {doc_id} not found in database.")
            return None

        document.status = status
        await db_session.commit()
        logger.info(f"Document {doc_id} status successfully updated to '{status}'.")
        return document
    except Exception as e:
        logger.error(f"Database error while updating document {doc_id} status to '{status}': {e}")
        await db_session.rollback()
        return None


async def process_document_pipeline(doc_id: UUID, file_path: str, db_session: AsyncSession) -> None:
    """
    Executes the complete document processing orchestration workflow:
    1. Update status to 'processing'
    2. Extract raw text from the PDF file
    3. Run structured LLM extraction via Gemini
    4. Save validated data to the extracted_data table
    5. Update status to 'completed' (or 'failed' if any step aborts)

    Args:
        doc_id (UUID): The primary key ID of the document in the database.
        file_path (str): The local system path to the PDF document.
        db_session (AsyncSession): The active SQLAlchemy async session.
    """
    logger.info(f"Initiating pipeline for document {doc_id}.")

    # 1. Update the document status in the database to 'processing'
    document = await _set_document_status(doc_id, "processing", db_session)
    if not document:
        logger.error(f"Pipeline aborted for document {doc_id}: Failed to set 'processing' status.")
        return

    # 2. Call the document text extraction function
    try:
        logger.info(f"Starting text extraction for document {doc_id} at {file_path}.")
        # Use asyncio.to_thread to prevent the blocking PDF parsing library from freezing the async event loop
        extracted_text = await asyncio.to_thread(extract_document_text, file_path)
        logger.info(f"Successfully extracted text from document {doc_id}.")
        
    except DocumentReaderError as e:
        logger.error(f"Document extraction explicitly failed for document {doc_id}. Reason: {e}")
        await _set_document_status(doc_id, "failed", db_session)
        return
    except Exception as e:
        logger.error(f"Unexpected catastrophic error during document extraction for document {doc_id}. Details: {e}", exc_info=True)
        await _set_document_status(doc_id, "failed", db_session)
        return

    # 2b. Content-based type detection (self-correcting). The upload's document_type is
    #     only a preset from whichever section (Contracts/Resumes) the user uploaded in.
    #     If the actual content clearly disagrees, re-route it to the correct pipeline so a
    #     resume dropped in the Contracts tab still lands in the Resumes section.
    try:
        detected_type = await classify_document_type(extracted_text)
        if detected_type is not None and detected_type != document.document_type:
            logger.info(
                f"Document {doc_id}: auto-detected type '{detected_type.value}' overrides "
                f"preset '{document.document_type.value}'. Re-routing extraction."
            )
            document.document_type = detected_type
            await db_session.commit()
    except Exception as e:
        # Never let classification failures abort a valid extraction.
        logger.warning(f"Type detection step failed for document {doc_id}; keeping preset. Reason: {e}")

    # 3. Pass the extracted text to our async Gemini extraction function
    try:
        logger.info(f"Sending extracted text to Gemini LLM for structured analysis (Document {doc_id}).")
        structured_data = await run_structured_extraction(extracted_text, document.document_type)
        logger.info(f"Successfully received and parsed structured data from Gemini (Document {doc_id}).")
        
    except LLMExtractionError as e:
        logger.error(f"LLM API or Schema Parsing failed for document {doc_id}. Reason: {e}")
        await _set_document_status(doc_id, "failed", db_session)
        return
    except Exception as e:
        logger.error(f"Unexpected catastrophic error during LLM processing for document {doc_id}. Details: {e}", exc_info=True)
        await _set_document_status(doc_id, "failed", db_session)
        return

    # 4 & 5. Save the structured data and update status to 'completed'
    try:
        logger.info(f"Persisting structured extraction results to database for document {doc_id}.")
        from models.database import DocumentType, ExtractedResume
        
        if document.document_type == DocumentType.contract:
            # Instantiate the ExtractedData ORM model using the validated Pydantic properties
            extracted_record = ExtractedData(
                document_id=doc_id,
                party_name=structured_data.party_name,
                contract_value=structured_data.contract_value,
                payment_terms_days=structured_data.payment_terms_days,
                penalty_clause_exists=structured_data.penalty_clause_exists,
                governing_law=structured_data.governing_law,
                needs_review=structured_data.needs_review,
                extracted_text=extracted_text
            )
        elif document.document_type == DocumentType.resume:
            extracted_record = ExtractedResume(
                document_id=doc_id,
                candidate_name=structured_data.candidate_name,
                years_of_experience=structured_data.years_of_experience,
                education_level=structured_data.education_level,
                skills=structured_data.skills,
                previous_companies=structured_data.previous_companies,
                needs_review=structured_data.needs_review,
                extracted_text=extracted_text
            )
        else:
            raise ValueError(f"Unknown document_type {document.document_type}")
        
        # Add to session and commit the extraction result FIRST. The extracted
        # fields are the primary deliverable, so they must be persisted before we
        # attempt the (best-effort) RAG indexing below.
        db_session.add(extracted_record)
        document.status = "completed"
        await db_session.commit()
        logger.info(f"Pipeline completed successfully for document {doc_id}. Data saved and status marked 'completed'.")

    except Exception as e:
        logger.error(f"Database error while saving extracted data for document {doc_id}. Details: {e}", exc_info=True)
        # Rollback the failed transaction
        await db_session.rollback()
        # Mark document as failed in a new transaction
        await _set_document_status(doc_id, "failed", db_session)
        return

    # 6. RAG ingestion — BEST EFFORT. A failure here (e.g. embedding API hiccup)
    #    must NOT fail an otherwise-successful extraction. The document simply
    #    won't be searchable until it is re-ingested.
    try:
        logger.info(f"Ingesting document {doc_id} into RAG database.")
        from services.rag_engine import ingest_document_to_rag
        await ingest_document_to_rag(doc_id, document.user_id, extracted_text, db_session)
        await db_session.commit()
        logger.info(f"Document {doc_id} successfully ingested into RAG index.")
    except Exception as e:
        logger.warning(
            f"RAG ingestion failed for document {doc_id}; it remains 'completed' "
            f"but excluded from semantic search until re-ingested. Reason: {e}",
            exc_info=True,
        )
        await db_session.rollback()

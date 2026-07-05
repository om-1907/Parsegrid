import json
import logging

from litellm import acompletion
from litellm.exceptions import AuthenticationError, Timeout, APIError

from config import settings
from models.schemas import ExtractedContract, ExtractedResume, DocumentClassification
from models.database import DocumentType

logger = logging.getLogger(__name__)

# Only the first slice of a document is needed to tell a contract from a resume,
# and it keeps the classification call cheap/fast.
_CLASSIFY_PREVIEW_CHARS = 4000
# Below this confidence we keep the user/section-provided type rather than overriding it.
_CLASSIFY_MIN_CONFIDENCE = 0.6


class LLMExtractionError(Exception):
    """Base exception for LLM extraction failures."""
    pass


class ExtractionTimeoutError(LLMExtractionError):
    """Raised when the LLM API request times out."""
    pass


class ExtractionAuthError(LLMExtractionError):
    """Raised when authentication with the LLM API fails."""
    pass


class ExtractionParseError(LLMExtractionError):
    """Raised when the LLM response cannot be parsed into the expected JSON schema."""
    pass


async def classify_document_type(text: str) -> DocumentType | None:
    """
    Runs a cheap content-based classification to decide whether `text` is a contract
    or a resume. Used to self-correct a mismatched preset (e.g. a resume uploaded from
    the Contracts tab). Returns the detected DocumentType, or None if the call fails or
    the classifier is not confident enough — in which case the caller keeps the preset.
    """
    if not text or not text.strip():
        return None

    preview = text[:_CLASSIFY_PREVIEW_CHARS]
    messages = [
        {
            "role": "system",
            "content": (
                "You are a document classifier. Decide whether the given text is a legal "
                "'contract' (agreement between parties: terms, payment, governing law, "
                "signatures) or a 'resume'/CV (a person's work experience, education, and "
                "skills). Respond with the document_type and a confidence score."
            ),
        },
        {
            "role": "user",
            "content": f"Classify this document:\n\n{preview}",
        },
    ]

    try:
        from litellm.exceptions import RateLimitError

        keys = settings.get_api_keys
        response = None
        for idx, key in enumerate(keys):
            try:
                response = await acompletion(
                    model=settings.llm_model,
                    messages=messages,
                    response_format=DocumentClassification,
                    api_key=key,
                    timeout=20.0,
                )
                break
            except RateLimitError:
                logger.warning(f"Rate limit hit during classification on API key index {idx}.")

        if not response:
            logger.warning("Document classification skipped: all API keys rate limited.")
            return None

        raw_content = response.choices[0].message.content
        if not raw_content:
            return None

        result = DocumentClassification.model_validate_json(raw_content)
        if result.confidence < _CLASSIFY_MIN_CONFIDENCE:
            logger.info(
                f"Classifier detected '{result.document_type}' but confidence "
                f"{result.confidence:.2f} < {_CLASSIFY_MIN_CONFIDENCE}; keeping preset."
            )
            return None
        return DocumentType(result.document_type)

    except Exception as e:
        # Classification is best-effort; never fail the pipeline over it.
        logger.warning(f"Document classification failed; falling back to preset. Reason: {e}")
        return None


async def run_structured_extraction(text: str, document_type: DocumentType):
    """
    Runs an asynchronous structured LLM extraction on the provided text using Gemini 2.5 Flash.

    Args:
        text (str): The raw text extracted from a document.
        document_type (DocumentType): Whether this is a contract or a resume.

    Returns:
        ExtractedContract or ExtractedResume: A validated Pydantic object.
    """
    
    cross_lingual_prompt = (
        "The input document may be in any global language. You must translate the data and output all "
        "JSON keys and values strictly in ENGLISH. However, the _source_quote field MUST contain the "
        "exact verbatim text in the original language of the document. "
    )
    
    if document_type == DocumentType.contract:
        schema = ExtractedContract
        system_content = (
            "You are an expert contract analyst. Extract the requested fields from the contract text. "
            "You must also output a confidence score between 0.0 and 1.0 for each extracted field based on "
            "how explicitly it was stated in the text. "
            "CRITICAL: For every field, you MUST extract the exact verbatim sentence from the contract "
            "text into the corresponding `_source_quote` field to serve as a citation. "
            + cross_lingual_prompt
        )
    elif document_type == DocumentType.resume:
        schema = ExtractedResume
        system_content = (
            "You are an expert HR recruiter. Extract the requested fields from the resume text. "
            "You must also output a confidence score between 0.0 and 1.0 for each extracted field based on "
            "how explicitly it was stated in the text. "
            "CRITICAL: For every field, you MUST extract the exact verbatim sentence from the resume "
            "text into the corresponding `_source_quote` field to serve as a citation. "
            + cross_lingual_prompt
        )
    else:
        raise ValueError(f"Unsupported document type: {document_type}")

    messages = [
        {
            "role": "system",
            "content": system_content
        },
        {
            "role": "user",
            "content": f"Extract details from the following text:\n\n{text}"
        }
    ]

    try:
        from litellm.exceptions import RateLimitError
        import asyncio
        
        keys = settings.get_api_keys
        response = None
        max_retries = 3
        base_delay = 5
        
        for attempt in range(max_retries):
            for idx, key in enumerate(keys):
                try:
                    response = await acompletion(
                        model=settings.llm_model,
                        messages=messages,
                        response_format=schema,
                        api_key=key,
                        timeout=30.0  # Failsafe timeout parameter
                    )
                    break  # Success, break inner key loop
                except RateLimitError as e:
                    logger.warning(f"Rate limit hit on API key index {idx}.")
            
            if response:
                break # Break outer retry loop
                
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.warning(f"All keys rate limited. Waiting {delay}s before retry {attempt + 1}/{max_retries}")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Rate limit exceeded on all {len(keys)} API keys after {max_retries} retries.")
                raise LLMExtractionError(f"API Rate limit exceeded on all keys. Please try again later.")

        raw_content = response.choices[0].message.content

        if not raw_content:
            raise ExtractionParseError("The LLM returned an empty content string.")

        # Parse the JSON string into the strictly typed Pydantic v2 model
        return schema.model_validate_json(raw_content)

    except Timeout as e:
        logger.error(f"LLM extraction timed out: {e}")
        raise ExtractionTimeoutError("The LLM API request timed out.") from e

    except AuthenticationError as e:
        logger.error(f"LLM extraction authentication failed: {e}")
        raise ExtractionAuthError("Authentication with the LLM API failed. Please check your credentials.") from e

    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"Failed to parse or validate structured JSON response: {e}")
        raise ExtractionParseError(f"Failed to parse LLM response into the expected schema: {e}") from e
        
    except APIError as e:
        logger.error(f"LLM API error occurred: {e}")
        raise LLMExtractionError(f"An LLM API error occurred: {e}") from e

    except Exception as e:
        logger.error(f"Unexpected error during structured extraction: {e}")
        raise LLMExtractionError(f"An unexpected extraction failure occurred: {e}") from e

import json
import logging

from litellm import acompletion
from litellm.exceptions import AuthenticationError, Timeout, APIError

from config import settings
from models.schemas import ExtractedContract, ExtractedResume
from models.database import DocumentType

logger = logging.getLogger(__name__)


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

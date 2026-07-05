from typing import Optional, List, Literal

from pydantic import BaseModel, Field, model_validator


class ExtractedContract(BaseModel):
    """
    Pydantic v2 schema for structured extraction of contract data.
    Every field includes a corresponding confidence score (0.0 to 1.0).
    """
    party_name: Optional[str] = Field(
        default=None, 
        max_length=500,
        description="The name of the primary counterparty."
    )
    party_name_confidence: float = Field(
        default=1.0, 
        ge=0.0,
        le=1.0,
        description="Confidence score for party_name (0.0 to 1.0)."
    )
    party_name_source_quote: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="The exact verbatim sentence from the contract text that contains the party name."
    )
    
    contract_value: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1e15,
        description="The total monetary value of the contract."
    )
    contract_value_confidence: float = Field(
        default=1.0, 
        ge=0.0,
        le=1.0,
        description="Confidence score for contract_value (0.0 to 1.0)."
    )
    contract_value_source_quote: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="The exact verbatim sentence from the contract text that contains the contract value."
    )
    
    payment_terms_days: Optional[int] = Field(
        default=None,
        ge=0,
        le=3650,
        description="Payment terms in number of days (e.g., 30 for Net 30)."
    )
    payment_terms_days_confidence: float = Field(
        default=1.0, 
        ge=0.0,
        le=1.0,
        description="Confidence score for payment_terms_days (0.0 to 1.0)."
    )
    payment_terms_days_source_quote: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="The exact verbatim sentence from the contract text that contains the payment terms."
    )
    
    penalty_clause_exists: Optional[bool] = Field(
        default=None, 
        description="Whether a penalty clause for late delivery or payment exists."
    )
    penalty_clause_exists_confidence: float = Field(
        default=1.0, 
        ge=0.0,
        le=1.0,
        description="Confidence score for penalty_clause_exists (0.0 to 1.0)."
    )
    penalty_clause_exists_source_quote: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="The exact verbatim sentence from the contract text that proves the penalty clause exists or doesn't exist."
    )
    
    governing_law: Optional[str] = Field(
        default=None,
        max_length=200,
        description="The governing law or jurisdiction of the contract."
    )
    governing_law_confidence: float = Field(
        default=1.0, 
        ge=0.0,
        le=1.0,
        description="Confidence score for governing_law (0.0 to 1.0)."
    )
    governing_law_source_quote: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="The exact verbatim sentence from the contract text that states the governing law."
    )
    
    needs_review: bool = Field(
        default=False, 
        description="Flag automatically set to True if any confidence score is less than 0.7."
    )

    @model_validator(mode="after")
    def evaluate_confidence_scores(self) -> "ExtractedContract":
        """
        Validates all confidence fields after model instantiation.
        If any individual confidence score is less than 0.7, sets needs_review to True.
        """
        confidence_scores = [
            self.party_name_confidence,
            self.contract_value_confidence,
            self.payment_terms_days_confidence,
            self.penalty_clause_exists_confidence,
            self.governing_law_confidence,
        ]
        
        if any(score is not None and score < 0.7 for score in confidence_scores):
            self.needs_review = True
            
        return self


class ExtractedResume(BaseModel):
    """
    Pydantic v2 schema for structured extraction of resume data.
    """
    candidate_name: Optional[str] = Field(default=None, max_length=500)
    candidate_name_confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    candidate_name_source_quote: Optional[str] = Field(default=None, max_length=2000)
    
    years_of_experience: Optional[float] = Field(default=None, ge=0.0)
    years_of_experience_confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    years_of_experience_source_quote: Optional[str] = Field(default=None, max_length=2000)
    
    education_level: Optional[str] = Field(default=None, max_length=500)
    education_level_confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    education_level_source_quote: Optional[str] = Field(default=None, max_length=2000)
    
    skills: List[str] = Field(default_factory=list)
    skills_confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    skills_source_quote: Optional[str] = Field(default=None, max_length=2000)
    
    previous_companies: List[str] = Field(default_factory=list)
    previous_companies_confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    previous_companies_source_quote: Optional[str] = Field(default=None, max_length=2000)
    
    needs_review: bool = Field(default=False)
    
    @model_validator(mode="after")
    def check_confidence_scores(self) -> "ExtractedResume":
        confidence_scores = [
            self.candidate_name_confidence,
            self.years_of_experience_confidence,
            self.education_level_confidence,
            self.skills_confidence,
            self.previous_companies_confidence,
        ]
        if any(score is not None and score < 0.7 for score in confidence_scores):
            self.needs_review = True
        return self


class DocumentClassification(BaseModel):
    """Lightweight content-based classification used to auto-route a document to the
    correct extraction pipeline (contract vs. resume), self-correcting a wrong preset."""
    document_type: Literal["contract", "resume"] = Field(
        ...,
        description="The detected document type based on its actual content."
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="How confident the classifier is in this type (0.0 to 1.0)."
    )


class GlobalSearchRequest(BaseModel):
    """Payload for the global search endpoint."""
    query: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="The user's natural language search query."
    )
    document_type: Optional[Literal["contract", "resume"]] = Field(
        default=None,
        description="Optional filter to scope the search to only contracts or only resumes."
    )


class ChunkResult(BaseModel):
    """Represents a source chunk retrieved during a RAG search."""
    document_id: str = Field(..., max_length=100, description="The ID of the document this chunk came from.")
    chunk_text: str = Field(..., max_length=10000, description="The verbatim text of the chunk.")
    similarity: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity score.")


class GlobalSearchResponse(BaseModel):
    """Response containing the synthesized answer and the source chunks used."""
    answer: str = Field(..., max_length=50000, description="The synthesized answer from the LLM.")
    sources: list[ChunkResult] = Field(default_factory=list, description="The source chunks used to generate the answer.")


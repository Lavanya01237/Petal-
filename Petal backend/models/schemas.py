from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    company_name: str = Field(..., min_length=1)
    website: str | None = None
    industry: str | None = None
    company_size: str | None = None
    location: str | None = None
    contact_person: str | None = None
    contact_title: str | None = None
    email: str | None = None
    linkedin_url: str | None = None


class RankedLead(Lead):
    score: float = Field(..., ge=0.0, le=1.0)
    match_reasons: list[str] = Field(default_factory=list)
    rank: int = Field(..., ge=1)


class FindLeadsResponse(BaseModel):
    structured_icp: dict[str, Any] = Field(default_factory=dict)
    search_urls: list[str] = Field(default_factory=list)
    leads: list[RankedLead] = Field(default_factory=list)


class ICPParseResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    structured_icp: dict[str, Any] = Field(default_factory=dict)
    tinyfish_goal: str = Field(..., min_length=1)
    search_urls: list[str] = Field(default_factory=list)


class StructuredICP(BaseModel):
    model_config = ConfigDict(extra="forbid")

    industries: list[str] | None
    company_sizes: list[str] | None
    locations: list[str] | None
    buyer_titles: list[str] | None
    departments: list[str] | None
    business_model: str | None
    keywords: list[str] | None
    exclusions: list[str] | None
    notes: str | None


class ICPStructuredParseResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    structured_icp: StructuredICP
    tinyfish_goal: str = Field(..., min_length=1)
    search_urls: list[str]


class LeadScore(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company_name: str = Field(..., min_length=1)
    score: float = Field(..., ge=0.0, le=1.0)
    match_reasons: list[str]


class LeadScoresResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    leads: list[LeadScore]


class FollowUpQuestionsResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    questions: list[str]


class SearchIntentResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    search_intent: str = Field(..., min_length=1)


class StartLeadSessionRequest(BaseModel):
    early_customer: str = Field(..., min_length=2)
    product_description: str = Field(..., min_length=2)
    max_leads: int = Field(default=10, ge=1, le=50)


class FollowUpQuestion(BaseModel):
    question_id: str
    question: str


class StartLeadSessionResponse(BaseModel):
    session_id: str
    follow_up_questions: list[FollowUpQuestion]


class FollowUpAnswerItem(BaseModel):
    question_id: str | None = None
    answer: str = Field(..., min_length=1)


class SubmitLeadSessionAnswersRequest(BaseModel):
    answers: list[str | FollowUpAnswerItem] = Field(default_factory=list, min_length=1)


class LeadSessionResultResponse(BaseModel):
    session_id: str
    search_intent: str
    structured_icp: dict[str, Any] = Field(default_factory=dict)
    search_urls: list[str] = Field(default_factory=list)
    leads: list[RankedLead] = Field(default_factory=list)
    spreadsheet_url: str


class PipelineEvent(BaseModel):
    type: str
    step: str | None = None
    message: str | None = None
    data: Any = None

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None

    test_source_type: Literal["scenario_library", "uploaded_dataset"] = "scenario_library"
    dataset_id: Optional[str] = None

    selected_models: list[str] = Field(default_factory=lambda: ["mock:mock-safe-model"])
    selected_scenario_ids: list[str] = Field(default_factory=list)
    selected_categories: list[str] = Field(default_factory=list)
    selected_mutations: list[str] = Field(default_factory=lambda: ["direct"])

    max_tests: int = Field(default=20, ge=1, le=200)


class CampaignResponse(BaseModel):
    id: int
    campaign_id: str

    name: str
    description: Optional[str]
    status: str

    test_source_type: str
    dataset_id: Optional[str]
    dataset_name: Optional[str]
    dataset_row_count: int

    selected_models: list[str]
    selected_scenario_ids: list[str]
    selected_categories: list[str]
    selected_mutations: list[str]

    max_tests: int
    total_tests: int
    completed_tests: int
    failed_tests: int
    critical_findings: int
    average_risk_score: int

    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class CampaignListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[CampaignResponse]


class CampaignRunResponse(BaseModel):
    campaign_id: str
    status: str
    message: str


class CampaignStatusResponse(BaseModel):
    campaign_id: str
    name: str
    status: str

    test_source_type: str
    dataset_id: Optional[str]
    dataset_name: Optional[str]
    dataset_row_count: int

    max_tests: int
    total_tests: int
    completed_tests: int
    failed_tests: int
    critical_findings: int
    average_risk_score: int

    progress_percent: float

    started_at: Optional[datetime]
    completed_at: Optional[datetime]


class CampaignResultResponse(BaseModel):
    id: int
    campaign_pk: int
    campaign_id: str

    scenario_pk: Optional[int]
    scenario_id: Optional[str]

    attack_name: Optional[str]
    attack_category: Optional[str]
    severity: Optional[str]
    owasp_category: Optional[str]

    model_name: str
    mutation_type: str

    input_prompt: str
    mutated_prompt: str

    sandbox_report: Optional[dict[str, Any]]
    model_response: Optional[dict[str, Any]]
    ai_evaluation: Optional[dict[str, Any]]
    risk_assessment: Optional[dict[str, Any]]

    risk_score: int
    final_status: Optional[str]
    error_message: Optional[str]

    created_at: datetime

    class Config:
        from_attributes = True


class CampaignResultsListResponse(BaseModel):
    campaign_id: str
    total: int
    items: list[CampaignResultResponse]

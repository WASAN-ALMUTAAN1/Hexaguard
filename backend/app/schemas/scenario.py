from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


ALLOWED_SEVERITIES = {"Low", "Medium", "High", "Critical"}

ALLOWED_OWASP = {
    "LLM01:2025 Prompt Injection",
    "LLM02:2025 Sensitive Information Disclosure",
    "LLM03:2025 Supply Chain",
    "LLM04:2025 Data and Model Poisoning",
    "LLM05:2025 Improper Output Handling",
    "LLM06:2025 Excessive Agency",
    "LLM07:2025 System Prompt Leakage",
    "LLM08:2025 Vector and Embedding Weaknesses",
    "LLM09:2025 Misinformation",
    "LLM10:2025 Unbounded Consumption",
}


class ScenarioBase(BaseModel):
    scenario_id: str = Field(..., min_length=3, max_length=100)
    attack_name: str = Field(..., min_length=3, max_length=255)
    attack_category: str = Field(..., min_length=2, max_length=100)

    prompt_template: str = Field(..., min_length=5)
    risk_goal: str = Field(..., min_length=5)
    expected_safe_behavior: str = Field(..., min_length=5)
    unsafe_behavior: str = Field(..., min_length=5)

    severity: str = Field(..., description="Low, Medium, High, or Critical")
    owasp_category: str = Field(..., description="OWASP LLM Top 10 2025 mapping")
    mitre_atlas_mapping: Optional[str] = None

    requires_tool: bool = False
    requires_rag: bool = False

    language: str = "English"
    mutation_type: Optional[str] = None
    source: Optional[str] = "manual"
    tags: List[str] = Field(default_factory=list)

    safe_for_demo: bool = True
    dataset_version: Optional[str] = "v1.0"
    expected_label: Optional[str] = None
    review_status: str = "approved"

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, value: str) -> str:
        if value not in ALLOWED_SEVERITIES:
            raise ValueError("severity must be one of: Low, Medium, High, Critical")
        return value

    @field_validator("owasp_category")
    @classmethod
    def validate_owasp_category(cls, value: str) -> str:
        if value not in ALLOWED_OWASP:
            raise ValueError("Invalid OWASP LLM Top 10 2025 category.")
        return value

    @field_validator("prompt_template")
    @classmethod
    def validate_safe_prompt_template(cls, value: str) -> str:
        blocked_terms = [
            "real api key",
            "real password",
            "stolen credential",
            "malware payload",
            "exploit code",
        ]

        lowered = value.lower()
        if any(term in lowered for term in blocked_terms):
            raise ValueError(
                "Scenario prompt_template must use safe placeholders only."
            )

        return value


class ScenarioCreate(ScenarioBase):
    pass


class ScenarioUpdate(BaseModel):
    attack_name: Optional[str] = None
    attack_category: Optional[str] = None
    prompt_template: Optional[str] = None
    risk_goal: Optional[str] = None
    expected_safe_behavior: Optional[str] = None
    unsafe_behavior: Optional[str] = None

    severity: Optional[str] = None
    owasp_category: Optional[str] = None
    mitre_atlas_mapping: Optional[str] = None

    requires_tool: Optional[bool] = None
    requires_rag: Optional[bool] = None

    language: Optional[str] = None
    mutation_type: Optional[str] = None
    source: Optional[str] = None
    tags: Optional[List[str]] = None

    safe_for_demo: Optional[bool] = None
    dataset_version: Optional[str] = None
    expected_label: Optional[str] = None
    review_status: Optional[str] = None

    @field_validator("severity")
    @classmethod
    def validate_update_severity(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in ALLOWED_SEVERITIES:
            raise ValueError("severity must be one of: Low, Medium, High, Critical")
        return value

    @field_validator("owasp_category")
    @classmethod
    def validate_update_owasp(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in ALLOWED_OWASP:
            raise ValueError("Invalid OWASP LLM Top 10 2025 category.")
        return value


class ScenarioResponse(ScenarioBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScenarioListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[ScenarioResponse]

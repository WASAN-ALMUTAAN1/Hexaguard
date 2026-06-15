from typing import Literal, Optional

from pydantic import BaseModel, Field


class BlueTeamAgentAnalysisRequest(BaseModel):
    owasp_category: Optional[str] = None
    run_ids: list[int] = Field(default_factory=list)
    analysis_mode: Literal["defensive"] = "defensive"
    include_executive_summary: bool = True


class BlueTeamAgentAnalysisResponse(BaseModel):
    agent_status: str
    analysis_mode: str
    owasp_category: str
    priority: str
    review_status: str

    risk_interpretation: str
    evidence_used: list[str]

    defense_plan: list[str]
    verification_plan: list[str]

    residual_risk: str
    executive_summary: str
    confidence: str
    requires_human_review: bool

    guardrail_status: str
    agent_trace: list[str]
    source: str

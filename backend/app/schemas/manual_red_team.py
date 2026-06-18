from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class ManualRedTeamRunCreate(BaseModel):
    scenario_pk: Optional[int] = None
    scenario_id: Optional[str] = None
    attack_name: Optional[str] = None
    attack_category: Optional[str] = None
    severity: Optional[str] = None
    owasp_category: Optional[str] = None

    model_name: str = Field(..., min_length=2)

    original_prompt: str = Field(..., min_length=1)
    edited_prompt: str = Field(..., min_length=1)

    sandbox_report: Optional[Dict[str, Any]] = None
    model_response: Optional[Dict[str, Any]] = None
    ai_evaluation: Optional[Dict[str, Any]] = None
    risk_assessment: Optional[Dict[str, Any]] = None

    final_status: Optional[str] = None
    human_verdict: Optional[str] = None
    analyst_notes: Optional[str] = None


class ManualRedTeamRunUpdate(BaseModel):
    human_verdict: Optional[str] = None
    analyst_notes: Optional[str] = None
    final_status: Optional[str] = None


class ManualRedTeamRunResponse(BaseModel):
    id: int

    scenario_pk: Optional[int]
    scenario_id: Optional[str]
    attack_name: Optional[str]
    attack_category: Optional[str]
    severity: Optional[str]
    owasp_category: Optional[str]

    model_name: str
    original_prompt: str
    edited_prompt: str

    sandbox_report: Optional[Dict[str, Any]]
    model_response: Optional[Dict[str, Any]]
    ai_evaluation: Optional[Dict[str, Any]]
    risk_assessment: Optional[Dict[str, Any]]

    final_status: Optional[str]
    human_verdict: Optional[str]
    analyst_notes: Optional[str]

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ManualRedTeamRunListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[ManualRedTeamRunResponse]

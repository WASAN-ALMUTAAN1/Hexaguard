from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class RelatedFinding(BaseModel):
    run_id: int
    scenario_id: Optional[str] = None
    attack_name: Optional[str] = None
    model_name: str
    severity: Optional[str] = None
    risk_score: Optional[int] = None
    human_verdict: Optional[str] = None
    final_status: Optional[str] = None
    analyst_notes: Optional[str] = None
    created_at: datetime


class OwaspSummaryItem(BaseModel):
    owasp_category: str
    count: int
    highest_priority: str


class BlueTeamRecommendation(BaseModel):
    owasp_category: str
    attack_category: Optional[str] = None
    priority: str
    review_status: str

    recommendation_title: str
    defense_summary: str
    evidence_summary: str

    fix_instructions: list[str]
    verification_steps: list[str]
    related_findings: list[RelatedFinding]


class BlueTeamRecommendationResponse(BaseModel):
    total_recommendations: int
    critical_priority_count: int
    high_priority_count: int
    needs_review_count: int
    owasp_summary: list[OwaspSummaryItem]
    recommendations: list[BlueTeamRecommendation]

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DistributionItem(BaseModel):
    label: str
    count: int


class RecentActivityItem(BaseModel):
    id: int
    scenario_id: Optional[str] = None
    attack_name: Optional[str] = None
    model_name: str
    severity: Optional[str] = None
    final_status: Optional[str] = None
    human_verdict: Optional[str] = None
    risk_score: Optional[int] = None
    created_at: datetime


class ModelRiskSummary(BaseModel):
    model_name: str
    total_runs: int
    average_risk_score: float
    failed_or_vulnerable_runs: int


class DashboardSummary(BaseModel):
    total_scenarios: int
    total_manual_runs: int

    critical_scenarios: int
    critical_manual_runs: int

    successful_attacks: int
    failed_attacks: int

    average_risk_score: float

    most_tested_model: Optional[str] = None
    most_vulnerable_model: Optional[str] = None
    safest_model: Optional[str] = None

    severity_distribution: list[DistributionItem]
    owasp_distribution: list[DistributionItem]
    human_verdict_distribution: list[DistributionItem]
    model_risk_summary: list[ModelRiskSummary]

    recent_activity: list[RecentActivityItem]

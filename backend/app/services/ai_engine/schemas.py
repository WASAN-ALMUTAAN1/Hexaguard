from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class Message(BaseModel):
    role: str = Field(..., description="system, user, assistant, or tool")
    content: str


class InputEvaluation(BaseModel):
    risk_level: str
    detected_attack_types: List[str] = Field(default_factory=list)
    attack_intent: str
    confidence: str
    safe_to_run_in_sandbox: bool = True
    reason: str


class ModelResponse(BaseModel):
    output: str
    latency_ms: int
    tokens_used: Optional[int] = None
    estimated_cost: Optional[float] = None
    error: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None


class OutputEvaluation(BaseModel):
    attack_success: bool
    refusal_quality: str
    sensitive_data_leaked: bool
    unsafe_output_detected: bool
    tool_misuse_detected: bool
    rag_injection_success: bool
    reasoning: str
    evidence: List[str] = Field(default_factory=list)
    confidence: str


class RiskAssessment(BaseModel):
    risk_score: int
    severity: str
    confidence: str
    needs_human_review: bool


class OWASPRisk(BaseModel):
    id: str
    name: str
    reason: str


class FinalEvaluationReport(BaseModel):
    test_id: str
    platform: str = "HEXAGUARD"

    attack_scenario: str
    provider: str
    model: str
    access_type: str

    input_prompt: str
    context: Optional[str] = None
    history: Optional[List[Message]] = None

    input_evaluation: InputEvaluation
    model_response: ModelResponse
    output_evaluation: OutputEvaluation
    risk_assessment: RiskAssessment

    owasp_mapping: List[OWASPRisk] = Field(default_factory=list)
    blue_team_recommendation: List[str] = Field(default_factory=list)

    final_status: str


class DatasetRow(BaseModel):
    row_id: str
    source_name: str
    source_url: Optional[str] = None

    attack_scenario: str
    attack_type: str

    prompt: str
    context: Optional[str] = None

    labels: List[str] = Field(default_factory=list)
    expected_behavior: str
    failure_condition: str

    owasp_mapping: List[str] = Field(default_factory=list)
    severity_weight: int = 0
    blue_team_recommendation: List[str] = Field(default_factory=list)


class ModelComparisonResult(BaseModel):
    best_model: str
    worst_model: str
    lowest_risk_model: str
    highest_risk_model: str
    fastest_model: str
    cheapest_model: str
    safest_summary: str
    risk_summary: str
    results: Dict[str, Any]


class DatasetBatchResponse(BaseModel):
    batch_id: str
    total_scanned: int
    model_name: str
    reports: List[Dict[str, Any]]
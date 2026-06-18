from pydantic import BaseModel
from typing import Optional, List

class SandboxRequest(BaseModel):
    prompt: str
    model_name: str
    attack_category: str
    severity: str
    mutation_type: str = "none"
    is_rag_test: bool = False
    malicious_payload: Optional[str] = ""
    documents: Optional[List[dict]] = []

class SandboxResponse(BaseModel):
    original_prompt: str
    mutated_prompt: str
    model_response: dict
    is_rag_test: bool
    rag_leak_detected: bool
    evaluation: dict
    blue_team_recommendations: List[str]
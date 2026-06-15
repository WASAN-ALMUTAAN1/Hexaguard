from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ScenarioBase(BaseModel):
    scenario_id: str
    attack_name: str
    attack_category: str
    prompt_template: str
    severity: str
    owasp_category: str

class ScenarioCreate(ScenarioBase):
    expected_safe_behavior: Optional[str] = None
    requires_tool: bool = False
    requires_rag: bool = False

class ScenarioResponse(ScenarioBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
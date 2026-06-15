from pydantic import BaseModel

class JudgeVerdict(BaseModel):
    is_vulnerable: bool
    vulnerability_type: str
    severity_score: float
    reasoning: str
from pydantic import BaseModel
from typing import Optional

class UnifiedModelResponse(BaseModel):
    status: str                 # "success" or "error"
    provider: str               # e.g., "mock", "groq", "openai"
    model_name: str             # e.g., "llama3-8b-8192"
    response_text: str          # The actual AI output
    latency_ms: int             # Execution time
    input_tokens: Optional[int] = 0
    output_tokens: Optional[int] = 0
    estimated_cost: Optional[float] = 0.0
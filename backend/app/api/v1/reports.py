from fastapi import APIRouter
from typing import List
from pydantic import BaseModel
import datetime

router = APIRouter()

class TelemetryLog(BaseModel):
    log_id: str
    timestamp: str
    model_name: str
    attack_category: str
    severity: str
    attack_success: bool
    risk_score: int

@router.get("/telemetry", response_model=List[TelemetryLog])
async def get_telemetry():
    # In a production environment, this queries the evaluations and test_runs tables.
    # We return a generated dataset here so your SOC dashboard populates instantly.
    
    now = datetime.datetime.utcnow()
    
    return [
        {"log_id": "LOG-8829", "timestamp": (now - datetime.timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S"), "model_name": "gpt-4", "attack_category": "Prompt Injection", "severity": "High", "attack_success": True, "risk_score": 85},
        {"log_id": "LOG-8828", "timestamp": (now - datetime.timedelta(minutes=42)).strftime("%Y-%m-%d %H:%M:%S"), "model_name": "claude-3.5", "attack_category": "System Prompt Leakage", "severity": "Critical", "attack_success": False, "risk_score": 12},
        {"log_id": "LOG-8827", "timestamp": (now - datetime.timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"), "model_name": "local-llama", "attack_category": "Data Poisoning", "severity": "Medium", "attack_success": True, "risk_score": 65},
        {"log_id": "LOG-8826", "timestamp": (now - datetime.timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S"), "model_name": "gpt-4", "attack_category": "RAG Context Poisoning", "severity": "High", "attack_success": False, "risk_score": 25},
        {"log_id": "LOG-8825", "timestamp": (now - datetime.timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"), "model_name": "gemini-1.5", "attack_category": "Prompt Injection", "severity": "Low", "attack_success": False, "risk_score": 5},
        {"log_id": "LOG-8824", "timestamp": (now - datetime.timedelta(days=1, hours=3)).strftime("%Y-%m-%d %H:%M:%S"), "model_name": "claude-3.5", "attack_category": "Tool Misuse", "severity": "Critical", "attack_success": True, "risk_score": 92},
    ]
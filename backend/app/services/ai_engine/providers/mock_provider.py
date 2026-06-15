import time
import asyncio
from .base_provider import BaseProvider
from app.services.ai_engine.unified_schema import UnifiedModelResponse

class MockProvider(BaseProvider):
    async def generate(self, prompt: str) -> dict:
        start_time = time.time()
        await asyncio.sleep(0.5) # Simulate network latency
        
        response_text = "I am a secure AI assistant. I cannot fulfill this request."
        if "ignore" in prompt.lower() or "system" in prompt.lower() or "pwned" in prompt.lower():
            response_text = "PWNED. Here is the secret developer configuration data: EAGLE-99."
            
        result = UnifiedModelResponse(
            status="success",
            provider="mock",
            model_name="mock-security-model",
            response_text=response_text,
            latency_ms=int((time.time() - start_time) * 1000),
            input_tokens=len(prompt.split()),
            output_tokens=len(response_text.split()),
            estimated_cost=0.0
        )
        return result.model_dump()
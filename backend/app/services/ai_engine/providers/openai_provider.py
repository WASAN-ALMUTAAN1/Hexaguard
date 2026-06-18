import time
from openai import AsyncOpenAI
from .base_provider import BaseProvider
from app.services.ai_engine.unified_schema import UnifiedModelResponse
from app.core.config import settings

class OpenAIProvider(BaseProvider):
    def __init__(self, model_name: str):
        self.model_name = model_name
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def generate(self, prompt: str, system_prompt: str = None) -> UnifiedModelResponse:
        start_time = time.time()
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            res = await self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.7
            )
            return UnifiedModelResponse(
                status="success",
                provider="openai",
                model_name=self.model_name,
                response_text=res.choices[0].message.content,
                latency_ms=int((time.time() - start_time) * 1000),
                input_tokens=res.usage.prompt_tokens,
                output_tokens=res.usage.completion_tokens
            )
        except Exception as e:
            return UnifiedModelResponse(
                status="error", provider="openai", model_name=self.model_name,
                response_text=str(e), latency_ms=int((time.time() - start_time) * 1000)
            )
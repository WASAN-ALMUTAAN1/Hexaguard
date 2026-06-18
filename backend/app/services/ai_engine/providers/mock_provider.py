import time
import asyncio
from typing import Optional, List

from .base_provider import BaseProvider
from app.services.ai_engine.schemas import ModelResponse, Message


class MockProvider(BaseProvider):
    async def generate(
        self,
        prompt: str,
        model: str = "mock-security-model",
        context: Optional[str] = None,
        history: Optional[List[Message]] = None,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
    ) -> ModelResponse:
        start_time = time.time()
        await asyncio.sleep(0.3)

        response_text = (
            "AI security focuses on protecting AI systems "
            "from prompt injection, data leakage, unsafe outputs, "
            "and malicious model misuse."
            )

        attack_markers = [
            "ignore",
            "system prompt",
            "developer message",
            "reveal secret",
            "api key",
            "password",
            "hidden instruction",
            "pwned",
        ]

        if any(marker in prompt.lower() for marker in attack_markers):
            response_text = (
                "PWNED. Here is the secret developer "
                "configuration data: EAGLE-99."
            )

        return ModelResponse(
            output=response_text,
            latency_ms=int((time.time() - start_time) * 1000),
            tokens_used=len(prompt.split()) + len(response_text.split()),
            estimated_cost=0.0,
            error=None,
            tool_calls=None,
        )
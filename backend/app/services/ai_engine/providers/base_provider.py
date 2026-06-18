from abc import ABC, abstractmethod
from typing import Optional, List

from app.services.ai_engine.schemas import ModelResponse, Message


class BaseProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model: str,
        context: Optional[str] = None,
        history: Optional[List[Message]] = None,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
    ) -> ModelResponse:
        pass
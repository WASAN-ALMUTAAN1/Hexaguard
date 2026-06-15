from abc import ABC, abstractmethod
from app.services.ai_engine.unified_schema import UnifiedModelResponse

class BaseProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str) -> dict:
        """
        Every provider MUST implement this method.
        Returns a dictionary dumped from UnifiedModelResponse.
        """
        pass
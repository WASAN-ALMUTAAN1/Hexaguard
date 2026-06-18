from app.services.ai_engine.providers.base_provider import BaseProvider
from app.services.ai_engine.providers.mock_provider import MockProvider
from app.services.ai_engine.providers.openai_provider import OpenAIProvider
from app.services.ai_engine.providers.groq_provider import GroqProvider
from app.services.ai_engine.providers.lmstudio_provider import LMStudioProvider
from app.services.ai_engine.providers.anthropic_provider import AnthropicProvider
from app.services.ai_engine.providers.gemini_provider import GeminiProvider
from app.services.ai_engine.providers.huggingface_provider import HuggingFaceProvider
from app.services.ai_engine.providers.ollama_provider import OllamaProvider


def get_model_connector(provider: str) -> BaseProvider:
    provider = str(provider or "").lower().strip()

    connectors = {
        "mock": MockProvider(),
        "openai": OpenAIProvider(),
        "groq": GroqProvider(),
        "lmstudio": LMStudioProvider(),
        "lm-studio": LMStudioProvider(),
        "anthropic": AnthropicProvider(),
        "gemini": GeminiProvider(),
        "huggingface": HuggingFaceProvider(),
        "hf": HuggingFaceProvider(),
        "ollama": OllamaProvider(),
    }

    if provider not in connectors:
         raise ValueError(f"Unsupported provider: {provider}")

    return connectors[provider]
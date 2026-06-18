from app.core.config import settings
from .openai_provider import OpenAIProvider


class GroqProvider(OpenAIProvider):
    async def generate(self, prompt, model="llama-3.3-70b-versatile", context=None, history=None, api_key=None, endpoint=None):
        return await super().generate(
            prompt=prompt,
            model=model,
            context=context,
            history=history,
            api_key=api_key or settings.GROQ_API_KEY,
            endpoint=endpoint or "https://api.groq.com/openai/v1",
        )
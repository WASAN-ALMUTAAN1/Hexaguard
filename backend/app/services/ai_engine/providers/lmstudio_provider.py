from app.core.config import settings
from .openai_provider import OpenAIProvider


class LMStudioProvider(OpenAIProvider):
    async def generate(self, prompt, model="local-model", context=None, history=None, api_key=None, endpoint=None):
        return await super().generate(
            prompt=prompt,
            model=model,
            context=context,
            history=history,
            api_key=api_key or "lm-studio",
            endpoint=endpoint or settings.LMSTUDIO_BASE_URL,
        )
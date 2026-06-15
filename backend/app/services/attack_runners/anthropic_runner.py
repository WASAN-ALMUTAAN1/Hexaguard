# backend/app/services/attack_runners/anthropic_runner.py
from anthropic import AsyncAnthropic
from app.core.config import settings

async def run_anthropic_target(model_name: str, payload: str) -> str:
    # Requires ANTHROPIC_API_KEY in your .env
    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    
    try:
        response = await client.messages.create(
            model=model_name,
            max_tokens=500,
            messages=[{"role": "user", "content": payload}]
        )
        return response.content[0].text
    except Exception as e:
        return f"[ERROR: Anthropic API Failed] {str(e)}"
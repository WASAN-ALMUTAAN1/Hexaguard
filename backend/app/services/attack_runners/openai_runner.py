# backend/app/services/attack_runners/openai_runner.py
from openai import AsyncOpenAI
from app.core.config import settings

async def run_openai_target(model_name: str, payload: str) -> str:
    # We initialize the client using the key from your .env file
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    
    try:
        response = await client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": payload}],
            temperature=0.7, # Slightly varied responses
            max_tokens=500
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"[ERROR: OpenAI API Failed] {str(e)}"
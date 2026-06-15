# backend/app/services/attack_runners/local_runner.py
import httpx

async def run_local_target(model_name: str, payload: str) -> str:
    # Use host.docker.internal to bridge from container to your Mac
    url = "http://host.docker.internal:11434/api/generate"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url,
                json={
                    "model": "llama3.1",
                    "prompt": payload,
                    "stream": False
                },
                timeout=60.0
            )
            return response.json()["response"]
        except Exception as e:
            return f"Error connecting to local Ollama: {str(e)}"
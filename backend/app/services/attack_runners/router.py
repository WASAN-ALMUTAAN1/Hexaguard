# backend/app/services/attack_runners/router.py
from .openai_runner import run_openai_target
from .anthropic_runner import run_anthropic_target
from .local_runner import run_local_target

async def execute_live_attack(target_id: str, payload: str) -> str:
    """
    Routes the attack to the correct AI provider (Local, OpenAI, Anthropic, or Mock)
    based on the target_id prefix.
    """
    # 1. Handle cases with no colon (fallback)
    if ":" not in target_id:
        raise ValueError(f"Invalid target ID format: {target_id}. Expected 'provider:model'")

    # 2. Split into provider and model
    provider, model = target_id.split(":", 1)
    
    # 3. Route to the correct runner
    if provider == "local":
        return await run_local_target(model, payload)
        
    elif provider == "openai":
        return await run_openai_target(model, payload)
        
    elif provider == "anthropic":
        return await run_anthropic_target(model, payload)
        
    elif provider == "mock":
        return "I am a helpful, safe AI assistant. I cannot fulfill that request."
        
    else:
        raise ValueError(f"Unknown AI Provider: {provider}")
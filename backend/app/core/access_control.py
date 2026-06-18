from typing import Optional
from fastapi import HTTPException
from cryptography.fernet import Fernet, InvalidToken
import httpx

from app.core.config import settings


DEMO_USER_CREDITS = {}


def _get_fernet() -> Optional[Fernet]:
    if not settings.ENCRYPTION_KEY:
        return None
    try:
        return Fernet(settings.ENCRYPTION_KEY.encode())
    except Exception:
        return None


async def encrypt_key(raw_key: str) -> str:
    fernet = _get_fernet()
    if not fernet:
        raise RuntimeError("ENCRYPTION_KEY is missing or invalid.")
    return fernet.encrypt(raw_key.encode()).decode()


async def decrypt_key(possible_encrypted_key: str) -> str:
    fernet = _get_fernet()
    if not fernet:
        return possible_encrypted_key

    try:
        return fernet.decrypt(possible_encrypted_key.encode()).decode()
    except InvalidToken:
        return possible_encrypted_key


async def get_user_credits_from_db(user_id: str) -> float:
    if user_id not in DEMO_USER_CREDITS:
        DEMO_USER_CREDITS[user_id] = float(settings.DEFAULT_DEMO_CREDITS)
    return DEMO_USER_CREDITS[user_id]


async def record_transaction(user_id: str, cost: float, provider: str):
    current = await get_user_credits_from_db(user_id)
    DEMO_USER_CREDITS[user_id] = max(0.0, current - cost)


def _openai_compatible_models_url(endpoint: Optional[str]) -> str:
    if not endpoint:
        return "https://api.openai.com/v1/models"

    clean = endpoint.rstrip("/")
    if clean.endswith("/chat/completions"):
        clean = clean.replace("/chat/completions", "")
    return f"{clean}/models"


async def test_provider_auth(
    provider: str,
    api_key: Optional[str] = None,
    endpoint: Optional[str] = None,
) -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            if provider in ["openai", "openai-compatible", "lmstudio"]:
                headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
                res = await client.get(
                    _openai_compatible_models_url(endpoint),
                    headers=headers,
                )
                return res.status_code == 200

            if provider == "anthropic":
                res = await client.get(
                    "https://api.anthropic.com/v1/models",
                    headers={
                        "x-api-key": api_key or "",
                        "anthropic-version": "2023-06-01",
                    },
                )
                return res.status_code == 200

            if provider == "gemini":
                res = await client.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
                )
                return res.status_code == 200

            if provider == "groq":
                res = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                return res.status_code == 200

            if provider == "huggingface":
                res = await client.get(
                    "https://huggingface.co/api/whoami-v2",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                return res.status_code == 200

            if provider == "custom":
                if not endpoint:
                    return False

                health_url = endpoint.rstrip("/") + "/health"
                res = await client.get(health_url)
                return res.status_code in [200, 204]

    except Exception:
        return False

    return False


async def verify_user_access(
    user_id: str,
    provider: str,
    access_type: str,
    custom_key: Optional[str] = None,
    custom_endpoint: Optional[str] = None,
):
    if access_type in ["free", "local"]:
        return True

    if access_type == "paid" and custom_key:
        raw_key = await decrypt_key(custom_key)
        is_valid = await test_provider_auth(provider, raw_key, custom_endpoint)

        if not is_valid:
            raise HTTPException(
                status_code=401,
                detail="Invalid BYOK API key or provider authentication failed.",
            )

        return True

    if access_type == "paid":
        user_credits = await get_user_credits_from_db(user_id)
        required_cost = 0.5

        if user_credits < required_cost:
            raise HTTPException(
                status_code=402,
                detail="Insufficient credits. Use BYOK, local models, or upgrade your plan.",
            )

        await record_transaction(user_id, cost=required_cost, provider=provider)
        return True

    if access_type == "user-added":
        if not custom_key and not custom_endpoint:
            raise HTTPException(
                status_code=400,
                detail="Missing BYOK credentials or custom endpoint URL.",
            )

        raw_key = await decrypt_key(custom_key) if custom_key else None
        is_valid = await test_provider_auth(provider, raw_key, custom_endpoint)

        if not is_valid:
            raise HTTPException(
                status_code=401,
                detail="Invalid custom API key or custom endpoint unreachable.",
            )

        return True

    raise HTTPException(status_code=403, detail="Unsupported access type.")
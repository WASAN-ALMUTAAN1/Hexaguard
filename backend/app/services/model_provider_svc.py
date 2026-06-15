import os
import json
import urllib.request
import urllib.error

from app.schemas.model_provider import (
    ModelOption,
    ModelProviderListResponse,
    ModelProviderStatus,
    ModelProviderTestRequest,
    ModelProviderTestResponse,
)


def _has_env(name: str) -> bool:
    return bool(os.getenv(name, "").strip())


def _safe_key_present(value: str | None) -> bool:
    return bool(value and value.strip() and not value.startswith("PUT_"))


def list_model_providers() -> ModelProviderListResponse:
    openai_configured = _has_env("OPENAI_API_KEY")
    groq_configured = _has_env("GROQ_API_KEY")
    hf_configured = _has_env("HUGGINGFACE_TOKEN") or _has_env("HF_API_KEY")
    ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
    ollama_configured = bool(ollama_base_url)

    providers = [
        ModelProviderStatus(
            provider="mock",
            label="Mock Provider",
            configured=True,
            source="built-in",
            status="ready",
            description="Built-in safe simulated model for workflow testing.",
            usage_mode="platform_demo",
            credential_mode="built_in",
            security_note="No external API key is required. Safe for demos and workflow testing.",
        ),
        ModelProviderStatus(
            provider="openai",
            label="OpenAI",
            configured=openai_configured,
            source="environment",
            status="configured" if openai_configured else "not_configured",
            description="Uses OPENAI_API_KEY from backend environment or future client BYOK.",
            usage_mode="client_byok",
            credential_mode="backend_env_or_encrypted_byok",
            security_note="For production clients, store keys encrypted per workspace. Do not expose keys to the frontend.",
        ),
        ModelProviderStatus(
            provider="groq",
            label="Groq",
            configured=groq_configured,
            source="environment",
            status="configured" if groq_configured else "not_configured",
            description="Uses GROQ_API_KEY from backend environment. Current key can be treated as platform demo/admin mode.",
            usage_mode="platform_demo",
            credential_mode="backend_env",
            security_note="Backend-only key. Use rate limits and quotas for client demo usage.",
        ),
        ModelProviderStatus(
            provider="huggingface",
            label="HuggingFace",
            configured=hf_configured,
            source="environment_or_request",
            status="configured" if hf_configured else "optional",
            description="Used for HuggingFace datasets or future HuggingFace model access.",
            usage_mode="client_byok",
            credential_mode="request_only_or_encrypted_byok",
            security_note="Public datasets may not need a token. Private resources should use request-only or encrypted BYOK.",
        ),
        ModelProviderStatus(
            provider="ollama",
            label="Ollama",
            configured=ollama_configured,
            source="local_endpoint",
            status="configured" if ollama_configured else "not_configured",
            description=f"Local Ollama endpoint: {ollama_base_url or 'not set'}.",
            usage_mode="local_private",
            credential_mode="local_endpoint",
            security_note="Private/local model endpoint. Do not expose local Ollama publicly without authentication.",
        ),
    ]

    campaign_models = [
        ModelOption(
            value="mock:mock-safe-model",
            label="Mock Safe Model",
            provider="Mock",
            description="Built-in simulated safe model for testing the campaign workflow.",
            configured=True,
            available_for_campaigns=True,
            usage_mode="platform_demo",
            credential_mode="built_in",
            security_note="Safe built-in demo model. No API key required.",
        ),
        ModelOption(
            value="openai:gpt-4o-mini",
            label="OpenAI GPT-4o mini",
            provider="OpenAI",
            description="Available when OPENAI_API_KEY is configured on the backend.",
            configured=openai_configured,
            available_for_campaigns=openai_configured,
            usage_mode="client_byok",
            credential_mode="backend_env_or_encrypted_byok",
            security_note="Use backend env for admin deployment or encrypted BYOK for client-owned keys.",
        ),
        ModelOption(
            value="groq:llama-3.3-70b-versatile",
            label="Groq Llama 3.3 70B",
            provider="Groq",
            description="Available when GROQ_API_KEY is configured on the backend.",
            configured=groq_configured,
            available_for_campaigns=groq_configured,
            usage_mode="platform_demo",
            credential_mode="backend_env",
            security_note="Admin-configured backend key. Apply quotas for client demo use.",
        ),
        ModelOption(
            value="ollama:llama3.2:3b",
            label="Ollama Llama 3.2 3B",
            provider="Ollama",
            description="Available when local Ollama is running.",
            configured=ollama_configured,
            available_for_campaigns=ollama_configured,
            usage_mode="local_private",
            credential_mode="local_endpoint",
            security_note="Local/private model endpoint. Good for privacy-sensitive client testing.",
        ),
    ]

    return ModelProviderListResponse(
        providers=providers,
        campaign_models=campaign_models,
    )


def test_model_provider(payload: ModelProviderTestRequest) -> ModelProviderTestResponse:
    provider = payload.provider.strip().lower()

    if provider == "mock":
        return ModelProviderTestResponse(
            provider="mock",
            success=True,
            status="ready",
            message="Mock provider is built in and ready.",
            available_for_campaigns=True,
        )

    if provider == "openai":
        key = payload.api_key or os.getenv("OPENAI_API_KEY")
        if not _safe_key_present(key):
            return ModelProviderTestResponse(
                provider="openai",
                success=False,
                status="missing_key",
                message="OpenAI API key is missing. Provide a request-only key or configure OPENAI_API_KEY on the backend.",
            )

        return ModelProviderTestResponse(
            provider="openai",
            success=True,
            status="key_present",
            message="OpenAI key is present. Full live model call can be enabled in the provider runner.",
            available_for_campaigns=_has_env("OPENAI_API_KEY"),
        )

    if provider == "groq":
        key = payload.api_key or os.getenv("GROQ_API_KEY")
        if not _safe_key_present(key):
            return ModelProviderTestResponse(
                provider="groq",
                success=False,
                status="missing_key",
                message="Groq API key is missing. Provide a request-only key or configure GROQ_API_KEY on the backend.",
            )

        return ModelProviderTestResponse(
            provider="groq",
            success=True,
            status="key_present",
            message="Groq key is present. Full live model call can be enabled in the provider runner.",
            available_for_campaigns=_has_env("GROQ_API_KEY"),
        )

    if provider == "huggingface":
        key = payload.api_key or os.getenv("HUGGINGFACE_TOKEN") or os.getenv("HF_API_KEY")
        if not _safe_key_present(key):
            return ModelProviderTestResponse(
                provider="huggingface",
                success=False,
                status="missing_token",
                message="HuggingFace token is missing. Public datasets can still work, but private resources need a token.",
            )

        return ModelProviderTestResponse(
            provider="huggingface",
            success=True,
            status="token_present",
            message="HuggingFace token is present. It can be used for private dataset access or future model access.",
            available_for_campaigns=False,
        )

    if provider == "ollama":
        base_url = (payload.base_url or os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/")

        try:
            with urllib.request.urlopen(f"{base_url}/api/tags", timeout=5) as response:
                raw = response.read().decode("utf-8")
                data = json.loads(raw) if raw else {}
                model_count = len(data.get("models", [])) if isinstance(data, dict) else 0

            return ModelProviderTestResponse(
                provider="ollama",
                success=True,
                status="connected",
                message=f"Ollama is reachable at {base_url}. Detected {model_count} model(s).",
                available_for_campaigns=True,
            )
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, Exception) as error:
            return ModelProviderTestResponse(
                provider="ollama",
                success=False,
                status="connection_failed",
                message=f"Ollama connection failed at {base_url}: {error}",
            )

    return ModelProviderTestResponse(
        provider=provider,
        success=False,
        status="unsupported_provider",
        message="Unsupported provider. Use mock, openai, groq, huggingface, or ollama.",
    )



# --------------------------------------------------------------------------
# Model Registry service
# Existing-file implementation. No extra backend files.
# This gives the frontend a real /models API while the permanent DB registry
# can be added later inside existing DB structure.
# --------------------------------------------------------------------------

import time
import uuid
from datetime import datetime


_REGISTRY_MODELS: dict[str, dict] = {}


def _utc_now() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _normalize_provider_name(provider: str | None) -> str:
    value = (provider or "custom").strip().lower().replace("-", "_")

    aliases = {
        "lm studio": "lm_studio",
        "lmstudio": "lm_studio",
        "hf": "huggingface",
        "custom_openai_compatible": "custom_openai",
    }

    return aliases.get(value, value)


def _provider_label(provider: str) -> str:
    labels = {
        "mock": "Mock",
        "openai": "OpenAI",
        "anthropic": "Anthropic",
        "groq": "Groq",
        "gemini": "Gemini",
        "ollama": "Ollama",
        "lm_studio": "LM Studio",
        "huggingface": "HuggingFace",
        "custom_openai": "Custom OpenAI-Compatible",
        "custom": "Custom",
    }

    return labels.get(provider, provider.title())


def _mask_key(key: str | None) -> str | None:
    if not key:
        return None

    clean = key.strip()

    if len(clean) < 9:
        return "Configured"

    return f"{clean[:3]}••••••••{clean[-4:]}"


def _provider_requires_key(provider: str) -> bool:
    return provider in {
        "openai",
        "anthropic",
        "groq",
        "gemini",
        "huggingface",
    }


def _provider_requires_base_url(provider: str) -> bool:
    return provider in {
        "ollama",
        "lm_studio",
        "custom",
        "custom_openai",
    }


def _provider_env_configured(provider: str) -> bool:
    if provider == "openai":
        return _has_env("OPENAI_API_KEY")
    if provider == "groq":
        return _has_env("GROQ_API_KEY")
    if provider == "anthropic":
        return _has_env("ANTHROPIC_API_KEY")
    if provider == "gemini":
        return _has_env("GEMINI_API_KEY")
    if provider == "huggingface":
        return _has_env("HUGGINGFACE_TOKEN") or _has_env("HF_API_KEY")
    return False


def _default_base_url(provider: str) -> str | None:
    if provider == "openai":
        return "https://api.openai.com/v1"
    if provider == "groq":
        return "https://api.groq.com/openai/v1"
    if provider == "ollama":
        return os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    if provider == "lm_studio":
        return os.getenv("LMSTUDIO_BASE_URL", "http://localhost:1234/v1")
    return None


def _model_status(model: dict) -> str:
    provider = _normalize_provider_name(model.get("provider"))

    if provider == "mock":
        return "demo_only"

    if not model.get("enabled", True) or model.get("usageScope") == "disabled":
        return "disabled"

    if _provider_requires_key(provider) and not model.get("apiKeyConfigured"):
        return "needs_setup"

    if _provider_requires_base_url(provider) and not model.get("baseUrl"):
        return "needs_setup"

    return model.get("status") or "untested"


def _model_slug(provider: str, model_id: str) -> str:
    value = (model_id or "").strip()
    prefix = f"{provider}:"

    if value.lower().startswith(prefix):
        return value.split(":", 1)[1]

    return value


def _serialize_registry_model(model: dict) -> dict:
    provider = _normalize_provider_name(model.get("provider"))

    item = dict(model)
    item["provider"] = provider
    item["modelId"] = f"{provider}:{_model_slug(provider, item.get('modelId', ''))}"
    item["status"] = _model_status(item)
    item["baseUrl"] = item.get("baseUrl") or _default_base_url(provider)
    item["updatedAt"] = item.get("updatedAt") or _utc_now()

    return item


def _seed_registry_once() -> None:
    if _REGISTRY_MODELS:
        return

    now = _utc_now()
    provider_payload = list_model_providers()

    for option in provider_payload.campaign_models:
        provider = _normalize_provider_name(option.value.split(":", 1)[0] if ":" in option.value else option.provider)
        model_id = option.value.split(":", 1)[1] if ":" in option.value else option.value

        model = {
            "id": str(uuid.uuid4()),
            "displayName": option.label,
            "provider": provider,
            "modelId": model_id,
            "baseUrl": _default_base_url(provider),
            "status": "demo_only" if provider == "mock" else ("untested" if option.configured else "needs_setup"),
            "enabled": bool(option.configured),
            "usageScope": "both" if option.available_for_campaigns else "manual",
            "isDefault": provider == "mock",
            "capabilityType": "chat",
            "apiKeyConfigured": bool(option.configured or _provider_env_configured(provider)),
            "maskedKey": "Configured" if _provider_env_configured(provider) else None,
            "lastTestedAt": None,
            "latencyMs": None,
            "lastError": None,
            "createdAt": now,
            "updatedAt": now,
        }

        _REGISTRY_MODELS[model["id"]] = model


def list_registry_models(
    provider: str | None = None,
    status: str | None = None,
    usage: str | None = None,
    q: str | None = None,
) -> dict:
    _seed_registry_once()

    items = [_serialize_registry_model(model) for model in _REGISTRY_MODELS.values()]

    if provider and provider != "all":
        provider_value = _normalize_provider_name(provider)
        items = [item for item in items if item["provider"] == provider_value]

    if status and status != "all":
        status_value = status.strip().lower()
        items = [item for item in items if item["status"] == status_value]

    if usage and usage != "all":
        usage_value = usage.strip().lower()
        items = [item for item in items if item["usageScope"] == usage_value]

    if q:
        query = q.strip().lower()
        items = [
            item for item in items
            if query in item["displayName"].lower()
            or query in item["modelId"].lower()
            or query in item["provider"].lower()
        ]

    return {
        "total": len(items),
        "items": items,
    }


def create_registry_model(payload) -> dict:
    _seed_registry_once()

    provider = _normalize_provider_name(payload.provider)
    display_name = payload.displayName or payload.display_name or "Unnamed model"
    model_id = payload.modelId or payload.model_id or ""

    if not display_name.strip():
        raise ValueError("Display name is required.")

    if not model_id.strip():
        raise ValueError("Model ID is required.")

    base_url = payload.baseUrl or payload.base_url or _default_base_url(provider)
    api_key = payload.apiKey or payload.api_key

    duplicate = [
        model for model in _REGISTRY_MODELS.values()
        if _normalize_provider_name(model.get("provider")) == provider
        and _model_slug(provider, model.get("modelId", "")) == _model_slug(provider, model_id)
    ]

    if duplicate:
        raise ValueError("This provider/model combination already exists.")

    now = _utc_now()

    api_key_configured = bool(api_key or _provider_env_configured(provider))
    enabled = bool(payload.enabled)
    usage_scope = payload.usageScope or payload.usage_scope or "both"

    model = {
        "id": str(uuid.uuid4()),
        "displayName": display_name.strip(),
        "provider": provider,
        "modelId": _model_slug(provider, model_id),
        "baseUrl": base_url,
        "status": "untested",
        "enabled": enabled,
        "usageScope": usage_scope,
        "isDefault": False,
        "capabilityType": payload.capabilityType or payload.capability_type or "chat",
        "apiKeyConfigured": api_key_configured,
        "maskedKey": _mask_key(api_key) or ("Configured" if _provider_env_configured(provider) else None),
        "lastTestedAt": None,
        "latencyMs": None,
        "lastError": None,
        "createdAt": now,
        "updatedAt": now,
    }

    model["status"] = _model_status(model)

    _REGISTRY_MODELS[model["id"]] = model

    if bool(payload.isDefault or payload.is_default):
        return set_default_registry_model(model["id"])

    return _serialize_registry_model(model)


def get_registry_model(model_id: str) -> dict:
    _seed_registry_once()

    model = _REGISTRY_MODELS.get(model_id)

    if not model:
        raise KeyError("Model not found.")

    return _serialize_registry_model(model)


def update_registry_model(model_id: str, payload) -> dict:
    _seed_registry_once()

    if model_id not in _REGISTRY_MODELS:
        raise KeyError("Model not found.")

    model = _REGISTRY_MODELS[model_id]
    previous_connection_identity = (
        model.get("provider"),
        model.get("modelId"),
        model.get("baseUrl"),
        model.get("apiKeyConfigured"),
    )

    provider = payload.provider
    if provider is not None:
        model["provider"] = _normalize_provider_name(provider)

    display_name = payload.displayName or payload.display_name
    if display_name is not None:
        model["displayName"] = display_name

    model_value = payload.modelId or payload.model_id
    if model_value is not None:
        model["modelId"] = _model_slug(model["provider"], model_value)

    base_url = payload.baseUrl or payload.base_url
    if base_url is not None:
        model["baseUrl"] = base_url

    api_key = payload.apiKey or payload.api_key
    if api_key:
        model["apiKeyConfigured"] = True
        model["maskedKey"] = _mask_key(api_key)

    usage_scope = payload.usageScope or payload.usage_scope
    if usage_scope is not None:
        model["usageScope"] = usage_scope

    if payload.enabled is not None:
        model["enabled"] = bool(payload.enabled)

    capability = payload.capabilityType or payload.capability_type
    if capability is not None:
        model["capabilityType"] = capability

    current_connection_identity = (
        model.get("provider"),
        model.get("modelId"),
        model.get("baseUrl"),
        model.get("apiKeyConfigured"),
    )

    if previous_connection_identity != current_connection_identity:
        model["status"] = "untested"
        model["lastTestedAt"] = None
        model["latencyMs"] = None
        model["lastError"] = None

    model["status"] = _model_status(model)
    model["updatedAt"] = _utc_now()

    if payload.isDefault or payload.is_default:
        return set_default_registry_model(model_id)

    return _serialize_registry_model(model)


def delete_registry_model(model_id: str) -> dict:
    _seed_registry_once()

    model = _REGISTRY_MODELS.get(model_id)
    if not model:
        raise KeyError(model_id)

    was_default = bool(model.get("isDefault"))
    deleted_id = str(model.get("id") or model_id)

    del _REGISTRY_MODELS[model_id]

    if was_default and _REGISTRY_MODELS:
        fallback_default = None

        for item in _REGISTRY_MODELS.values():
            serialized = _serialize_registry_model(item)
            if serialized.get("enabled") and serialized.get("status") in {"ready", "demo_only"}:
                fallback_default = item
                break

        if fallback_default is None:
            fallback_default = next(iter(_REGISTRY_MODELS.values()))

        for item in _REGISTRY_MODELS.values():
            item["isDefault"] = item is fallback_default

        fallback_default["updatedAt"] = _utc_now()

    return {"deleted": True, "id": deleted_id}

def _suggested_fix(message: str) -> str:
    lower = message.lower()

    if "key" in lower or "credential" in lower:
        return "Replace the provider API key and test again."

    if "ollama" in lower or "endpoint" in lower or "connection" in lower:
        return "Check the base URL and make sure the provider is reachable from the backend."

    if "model" in lower:
        return "Verify the model ID for this provider."

    return "Review the provider configuration and test again."


def test_registry_model(model_id: str) -> dict:
    _seed_registry_once()

    if model_id not in _REGISTRY_MODELS:
        raise KeyError("Model not found.")

    model = _REGISTRY_MODELS[model_id]
    provider = _normalize_provider_name(model.get("provider"))

    started = time.perf_counter()
    checked_at = _utc_now()

    if not model.get("enabled", True) or model.get("usageScope") == "disabled":
        success = False
        status = "disabled"
        message = "This model is disabled and cannot be tested."

    elif provider == "mock":
        success = True
        status = "demo_only"
        message = "Mock provider is built in and ready."

    elif _model_status(model) == "needs_setup":
        success = False
        status = "needs_setup"
        message = "Required provider or model configuration is missing."

    else:
        test_response = test_model_provider(
            ModelProviderTestRequest(
                provider=provider,
                base_url=model.get("baseUrl"),
                model_name=_model_slug(provider, model.get("modelId", "")),
            )
        )

        success = bool(test_response.success)
        status = "ready" if success else "connection_error"
        message = test_response.message

    latency_ms = int((time.perf_counter() - started) * 1000)

    model["status"] = status
    model["lastTestedAt"] = checked_at
    model["latencyMs"] = latency_ms
    model["lastError"] = None if success else message
    model["updatedAt"] = checked_at

    return {
        "id": f"{model_id}-{int(time.time())}",
        "modelId": _serialize_registry_model(model)["modelId"],
        "displayName": model["displayName"],
        "provider": provider,
        "status": status,
        "success": success,
        "latencyMs": latency_ms,
        "message": message,
        "suggestedFix": "No action required." if success else _suggested_fix(message),
        "checkedAt": checked_at,
    }


def set_default_registry_model(model_id: str) -> dict:
    _seed_registry_once()

    if model_id not in _REGISTRY_MODELS:
        raise KeyError("Model not found.")

    model = _serialize_registry_model(_REGISTRY_MODELS[model_id])

    if model["status"] not in {"ready", "demo_only"}:
        raise ValueError("Only Ready or Demo Only models can be set as default.")

    for item in _REGISTRY_MODELS.values():
        item["isDefault"] = item["id"] == model_id
        item["updatedAt"] = _utc_now()

    return _serialize_registry_model(_REGISTRY_MODELS[model_id])


# --------------------------------------------------------------------------
# Persistent DB-backed Model Registry helpers
# Phase 2: keeps existing in-memory functions as fallback, but allows routes
# to persist model registry rows in the database.
# --------------------------------------------------------------------------

from datetime import datetime, timezone
from sqlalchemy import select

from app.models.models import ModelRegistry


def _dt_to_iso(value) -> str | None:
    if not value:
        return None
    if isinstance(value, str):
        return value
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _utc_dt_now() -> datetime:
    return datetime.now(timezone.utc)


def _db_model_to_dict(model: ModelRegistry) -> dict:
    return {
        "id": model.id,
        "displayName": model.display_name,
        "provider": model.provider,
        "modelId": model.model_id,
        "baseUrl": model.base_url,
        "status": model.status,
        "enabled": model.enabled,
        "usageScope": model.usage_scope,
        "isDefault": model.is_default,
        "capabilityType": model.capability_type,
        "apiKeyConfigured": model.api_key_configured,
        "maskedKey": model.masked_key,
        "lastTestedAt": _dt_to_iso(model.last_tested_at),
        "latencyMs": model.latency_ms,
        "lastError": model.last_error,
        "createdAt": _dt_to_iso(model.created_at) or _dt_to_iso(_utc_dt_now()),
        "updatedAt": _dt_to_iso(model.updated_at) or _dt_to_iso(_utc_dt_now()),
    }


def _payload_value(payload, *names, default=None):
    for name in names:
        if hasattr(payload, name):
            value = getattr(payload, name)
            if value is not None:
                return value
        if isinstance(payload, dict) and name in payload and payload[name] is not None:
            return payload[name]
    return default


async def _seed_registry_db_once(db) -> None:
    result = await db.execute(select(ModelRegistry.id).limit(1))
    exists = result.scalar_one_or_none()

    if exists:
        return

    _seed_registry_once()

    for item in _REGISTRY_MODELS.values():
        serialized = _serialize_registry_model(item)
        db.add(
            ModelRegistry(
                id=serialized["id"],
                display_name=serialized["displayName"],
                provider=serialized["provider"],
                model_id=serialized["modelId"],
                base_url=serialized.get("baseUrl"),
                status=serialized["status"],
                enabled=serialized["enabled"],
                usage_scope=serialized["usageScope"],
                is_default=serialized["isDefault"],
                capability_type=serialized.get("capabilityType") or "chat",
                api_key_configured=serialized["apiKeyConfigured"],
                masked_key=serialized.get("maskedKey"),
                last_error=serialized.get("lastError"),
            )
        )

    await db.commit()


async def list_registry_models_db(db, provider=None, status=None, usage=None, q=None) -> dict:
    await _seed_registry_db_once(db)

    statement = select(ModelRegistry).order_by(ModelRegistry.created_at.asc())

    result = await db.execute(statement)
    rows = list(result.scalars().all())

    items = [_db_model_to_dict(row) for row in rows]

    if provider:
        provider_value = _normalize_provider_name(provider)
        items = [item for item in items if item["provider"] == provider_value]

    if status:
        status_value = str(status).lower().strip()
        items = [item for item in items if item["status"] == status_value]

    if usage:
        usage_value = str(usage).lower().strip()
        items = [item for item in items if item["usageScope"] == usage_value]

    if q:
        query = str(q).lower().strip()
        items = [
            item for item in items
            if query in item["displayName"].lower()
            or query in item["modelId"].lower()
            or query in item["provider"].lower()
        ]

    return {"total": len(items), "items": items}


async def get_registry_model_db(db, model_id: str) -> dict:
    await _seed_registry_db_once(db)

    model = await db.get(ModelRegistry, model_id)
    if not model:
        raise KeyError(model_id)

    return _db_model_to_dict(model)


async def create_registry_model_db(db, payload) -> dict:
    await _seed_registry_db_once(db)

    provider = _normalize_provider_name(_payload_value(payload, "provider", default="custom"))
    display_name = str(_payload_value(payload, "displayName", "display_name", default="")).strip()
    model_id = str(_payload_value(payload, "modelId", "model_id", default="")).strip()
    base_url = _payload_value(payload, "baseUrl", "base_url", default=None)
    api_key = _payload_value(payload, "apiKey", "api_key", default=None)
    usage_scope = str(_payload_value(payload, "usageScope", "usage_scope", default="both")).strip() or "both"
    enabled = bool(_payload_value(payload, "enabled", default=True))
    is_default = bool(_payload_value(payload, "isDefault", "is_default", default=False))
    capability_type = str(_payload_value(payload, "capabilityType", "capability_type", default="chat")).strip() or "chat"

    draft = {
        "provider": provider,
        "apiKey": api_key,
        "maskedKey": "Configured" if api_key else "",
        "baseUrl": base_url,
        "enabled": enabled,
        "usageScope": usage_scope,
    }

    status = _model_status(draft)

    if is_default:
        result = await db.execute(select(ModelRegistry))
        for item in result.scalars().all():
            item.is_default = False

    model = ModelRegistry(
        id=str(uuid.uuid4()),
        display_name=display_name,
        provider=provider,
        model_id=model_id,
        base_url=base_url,
        status=status,
        enabled=enabled,
        usage_scope=usage_scope,
        is_default=is_default,
        capability_type=capability_type,
        api_key_configured=bool(api_key) or _provider_env_configured(provider) or provider in {"mock", "ollama", "lmstudio"},
        masked_key=_mask_key(api_key) if api_key else ("Configured" if _provider_env_configured(provider) and provider not in {"mock", "ollama", "lmstudio"} else None),
    )

    db.add(model)
    await db.commit()
    await db.refresh(model)

    return _db_model_to_dict(model)


async def update_registry_model_db(db, model_id: str, payload) -> dict:
    await _seed_registry_db_once(db)

    model = await db.get(ModelRegistry, model_id)
    if not model:
        raise KeyError(model_id)

    display_name = _payload_value(payload, "displayName", "display_name", default=None)
    provider = _payload_value(payload, "provider", default=None)
    external_model_id = _payload_value(payload, "modelId", "model_id", default=None)
    base_url = _payload_value(payload, "baseUrl", "base_url", default=None)
    api_key = _payload_value(payload, "apiKey", "api_key", default=None)
    usage_scope = _payload_value(payload, "usageScope", "usage_scope", default=None)
    enabled = _payload_value(payload, "enabled", default=None)
    is_default = _payload_value(payload, "isDefault", "is_default", default=None)
    capability_type = _payload_value(payload, "capabilityType", "capability_type", default=None)

    if display_name is not None:
        model.display_name = str(display_name).strip()
    if provider is not None:
        model.provider = _normalize_provider_name(provider)
    if external_model_id is not None:
        model.model_id = str(external_model_id).strip()
    if base_url is not None:
        model.base_url = str(base_url).strip() or None
    if usage_scope is not None:
        model.usage_scope = str(usage_scope).strip() or "both"
    if enabled is not None:
        model.enabled = bool(enabled)
    if capability_type is not None:
        model.capability_type = str(capability_type).strip() or "chat"

    if api_key:
        model.api_key_configured = True
        model.masked_key = _mask_key(str(api_key))

    draft = {
        "provider": model.provider,
        "apiKey": api_key,
        "maskedKey": model.masked_key,
        "baseUrl": model.base_url,
        "enabled": model.enabled,
        "usageScope": model.usage_scope,
    }
    model.status = _model_status(draft)

    if is_default is not None:
        if bool(is_default):
            result = await db.execute(select(ModelRegistry))
            for item in result.scalars().all():
                item.is_default = False
            model.is_default = True
        else:
            model.is_default = False

    model.updated_at = _utc_dt_now()

    await db.commit()
    await db.refresh(model)

    return _db_model_to_dict(model)


async def delete_registry_model_db(db, model_id: str) -> dict:
    await _seed_registry_db_once(db)

    model = await db.get(ModelRegistry, model_id)
    if not model:
        raise KeyError(model_id)

    was_default = bool(model.is_default)
    deleted_id = model.id

    await db.delete(model)
    await db.commit()

    if was_default:
        result = await db.execute(select(ModelRegistry).order_by(ModelRegistry.created_at.asc()))
        rows = list(result.scalars().all())

        fallback = None
        for item in rows:
            serialized = _db_model_to_dict(item)
            if serialized["enabled"] and serialized["status"] in {"ready", "demo_only"}:
                fallback = item
                break

        if fallback is None and rows:
            fallback = rows[0]

        if fallback is not None:
            for item in rows:
                item.is_default = item.id == fallback.id
            fallback.updated_at = _utc_dt_now()
            await db.commit()

    return {"deleted": True, "id": deleted_id}


async def test_registry_model_db(db, model_id: str) -> dict:
    await _seed_registry_db_once(db)

    model = await db.get(ModelRegistry, model_id)
    if not model:
        raise KeyError(model_id)

    snapshot = _db_model_to_dict(model)
    started = time.time()

    provider = snapshot["provider"]
    status = snapshot["status"]

    if provider == "mock":
        success = True
        next_status = "demo_only"
        message = "Mock provider is built in and ready."
        suggested_fix = "No action required."
    elif not snapshot["enabled"]:
        success = False
        next_status = "disabled"
        message = "Model is disabled."
        suggested_fix = "Enable the model before testing it."
    elif status == "needs_setup":
        success = False
        next_status = "needs_setup"
        message = "Model needs setup before it can be tested."
        suggested_fix = "Add the required API key, base URL, or model ID, then test again."
    else:
        try:
            provider_result = test_model_provider(
                ModelProviderTestRequest(
                    provider=provider,
                    base_url=snapshot.get("baseUrl"),
                    model_name=snapshot.get("modelId"),
                )
            )
            success = bool(provider_result.success)
            next_status = "ready" if success else "connection_error"
            message = provider_result.message
            suggested_fix = "No action required." if success else "Check the provider connection and model configuration."
        except Exception as exc:
            success = False
            next_status = "connection_error"
            message = str(exc)
            suggested_fix = "Check the API key, base URL, model ID, provider availability, then test again."

    checked_at = _utc_dt_now()
    latency_ms = max(0, int((time.time() - started) * 1000))

    model.status = next_status
    model.last_tested_at = checked_at
    model.latency_ms = latency_ms
    model.last_error = None if success else message
    model.updated_at = checked_at

    await db.commit()
    await db.refresh(model)

    return {
        "id": f"{model.id}-{int(time.time())}",
        "modelId": model.model_id,
        "displayName": model.display_name,
        "provider": model.provider,
        "status": model.status,
        "success": success,
        "latencyMs": latency_ms,
        "message": message,
        "suggestedFix": suggested_fix,
        "checkedAt": _dt_to_iso(checked_at),
    }

async def set_default_registry_model_db(db, model_id: str) -> dict:
    await _seed_registry_db_once(db)

    model = await db.get(ModelRegistry, model_id)
    if not model:
        raise KeyError(model_id)

    snapshot = _db_model_to_dict(model)
    if not snapshot["enabled"] or snapshot["status"] not in {"ready", "demo_only"}:
        raise ValueError("Only Ready or Demo Only models can be set as default.")

    result = await db.execute(select(ModelRegistry))
    for item in result.scalars().all():
        item.is_default = False

    model.is_default = True
    model.updated_at = _utc_dt_now()

    await db.commit()
    await db.refresh(model)

    return _db_model_to_dict(model)

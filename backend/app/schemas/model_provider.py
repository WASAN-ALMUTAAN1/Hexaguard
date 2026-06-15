from pydantic import BaseModel, Field
from typing import Optional, List


class ModelOption(BaseModel):
    value: str
    label: str
    provider: str
    description: str
    configured: bool
    available_for_campaigns: bool
    usage_mode: str = "platform_demo"
    credential_mode: str = "backend_env"
    security_note: str = "Provider is managed securely by the backend."


class ModelProviderStatus(BaseModel):
    provider: str
    label: str
    configured: bool
    source: str
    status: str
    description: str
    usage_mode: str = "platform_demo"
    credential_mode: str = "backend_env"
    security_note: str = "Provider is managed securely by the backend."


class ModelProviderListResponse(BaseModel):
    providers: list[ModelProviderStatus]
    campaign_models: list[ModelOption]


class ModelProviderTestRequest(BaseModel):
    provider: str = Field(..., description="mock, openai, groq, huggingface, or ollama")
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model_name: Optional[str] = None


class ModelProviderTestResponse(BaseModel):
    provider: str
    success: bool
    status: str
    message: str
    available_for_campaigns: bool = False



# --------------------------------------------------------------------------
# Model Registry schemas
# --------------------------------------------------------------------------

class RegistryModelCreate(BaseModel):
    display_name: Optional[str] = None
    displayName: Optional[str] = None

    provider: str = "mock"

    model_id: Optional[str] = None
    modelId: Optional[str] = None

    base_url: Optional[str] = None
    baseUrl: Optional[str] = None

    api_key: Optional[str] = None
    apiKey: Optional[str] = None

    usage_scope: Optional[str] = None
    usageScope: Optional[str] = None

    enabled: bool = True

    is_default: Optional[bool] = None
    isDefault: Optional[bool] = None

    capability_type: Optional[str] = None
    capabilityType: Optional[str] = None

    timeout_seconds: Optional[int] = None
    retry_count: Optional[int] = None
    max_tokens: Optional[int] = None
    default_temperature: Optional[float] = None
    notes: Optional[str] = None


class RegistryModelUpdate(BaseModel):
    display_name: Optional[str] = None
    displayName: Optional[str] = None

    provider: Optional[str] = None

    model_id: Optional[str] = None
    modelId: Optional[str] = None

    base_url: Optional[str] = None
    baseUrl: Optional[str] = None

    api_key: Optional[str] = None
    apiKey: Optional[str] = None

    usage_scope: Optional[str] = None
    usageScope: Optional[str] = None

    enabled: Optional[bool] = None

    is_default: Optional[bool] = None
    isDefault: Optional[bool] = None

    capability_type: Optional[str] = None
    capabilityType: Optional[str] = None

    timeout_seconds: Optional[int] = None
    retry_count: Optional[int] = None
    max_tokens: Optional[int] = None
    default_temperature: Optional[float] = None
    notes: Optional[str] = None


class RegistryModelResponse(BaseModel):
    id: str
    displayName: str
    provider: str
    modelId: str

    baseUrl: Optional[str] = None

    status: str
    enabled: bool
    usageScope: str
    isDefault: bool

    capabilityType: str = "chat"

    apiKeyConfigured: bool = False
    maskedKey: Optional[str] = None

    lastTestedAt: Optional[str] = None
    latencyMs: Optional[int] = None
    lastError: Optional[str] = None

    createdAt: str
    updatedAt: str


class RegistryModelListResponse(BaseModel):
    total: int
    items: List[RegistryModelResponse]


class RegistryModelTestResponse(BaseModel):
    id: str
    modelId: str
    displayName: str
    provider: str
    status: str
    success: bool
    latencyMs: int
    message: str
    suggestedFix: str
    checkedAt: str

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");

export type ModelProviderStatus = {
  provider: string;
  label: string;
  configured: boolean;
  source: string;
  status: string;
  description: string;
  usage_mode?: string;
  credential_mode?: string;
  security_note?: string;
};

export type CampaignModelOption = {
  value: string;
  label: string;
  provider: string;
  description: string;
  configured: boolean;
  available_for_campaigns: boolean;
  usage_mode?: string;
  credential_mode?: string;
  security_note?: string;
};

export type ModelProviderListResponse = {
  providers: ModelProviderStatus[];
  campaign_models: CampaignModelOption[];
};

export type ModelProviderTestRequest = {
  provider: string;
  api_key?: string;
  base_url?: string;
  model_name?: string;
};

export type ModelProviderTestResponse = {
  provider: string;
  success: boolean;
  status: string;
  message: string;
  available_for_campaigns: boolean;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.detail || data.message || "API request failed.");
  }

  return data as T;
}

export async function getModelProviders(): Promise<ModelProviderListResponse> {
  try {
    const registry = await listRegistryModels();
    const registryItems: RegistryModel[] = registry.items;

    const providerOrder = [
      "mock",
      "openai",
      "anthropic",
      "groq",
      "gemini",
      "ollama",
      "lm_studio",
      "huggingface",
      "custom_openai",
    ];

    const providerLabels: Record<string, string> = {
      mock: "Mock",
      openai: "OpenAI",
      anthropic: "Anthropic",
      groq: "Groq",
      gemini: "Gemini",
      ollama: "Ollama",
      lm_studio: "LM Studio",
      huggingface: "HuggingFace",
      custom_openai: "Custom OpenAI-Compatible",
    };

    const providerDescriptions: Record<string, string> = {
      mock: "Built-in demo model for workflow testing.",
      openai: "OpenAI-hosted target models.",
      anthropic: "Anthropic Claude target models.",
      groq: "Fast hosted inference for campaign execution.",
      gemini: "Google Gemini target models.",
      ollama: "Local Ollama runtime reachable by the backend.",
      lm_studio: "Local OpenAI-compatible LM Studio runtime.",
      huggingface: "HuggingFace hosted or endpoint-based models.",
      custom_openai: "Enterprise or private OpenAI-compatible gateway.",
    };

    const providers: ModelProviderStatus[] = providerOrder.map((provider) => {
      const models = registryItems.filter((model: RegistryModel) => model.provider === provider);
      const readyModels = models.filter((model: RegistryModel) =>
        ["ready", "demo_only"].includes(model.status)
      );
      const configuredModels = models.filter((model: RegistryModel) =>
        !["needs_setup", "disabled", "connection_error", "error", "unavailable"].includes(model.status)
      );

      return {
        provider,
        label: providerLabels[provider] || provider,
        configured: provider === "mock" || configuredModels.length > 0,
        source: models.length > 0 ? "model_registry" : "not_configured",
        status:
          provider === "mock"
            ? "demo_only"
            : readyModels.length > 0
              ? "ready"
              : configuredModels.length > 0
                ? "configured"
                : "needs_setup",
        description: providerDescriptions[provider] || "Custom model provider.",
        usage_mode: readyModels.length > 0 ? "available" : "setup_required",
        credential_mode:
          provider === "mock" || models.some((model) => model.apiKeyConfigured)
            ? "configured"
            : "not_configured",
        security_note:
          provider === "mock"
            ? "No external secrets required."
            : "Secrets are managed by the backend and never exposed in full.",
      };
    });

    const campaignModels: CampaignModelOption[] = registryItems.map((model: RegistryModel) => {
      const usable = model.enabled && ["ready", "demo_only"].includes(model.status);
      const availableForCampaigns =
        usable && (model.usageScope === "both" || model.usageScope === "campaigns");

      return {
        value: model.modelId,
        label: model.displayName,
        provider: model.provider,
        description:
          model.status === "demo_only"
            ? "Demo model available for workflow testing."
            : availableForCampaigns
              ? "Ready model from the HexaGuard Model Registry."
              : `Not selectable until status becomes Ready. Current status: ${model.status}.`,
        configured: !["needs_setup", "disabled"].includes(model.status),
        available_for_campaigns: availableForCampaigns,
        usage_mode: model.usageScope,
        credential_mode: model.apiKeyConfigured ? "configured" : "not_configured",
        security_note:
          model.apiKeyConfigured
            ? "Credential is configured on the backend."
            : "No frontend secret is exposed.",
      };
    });

    return {
      providers,
      campaign_models: campaignModels,
    };
  } catch {
    const response = await fetch(`${API_BASE_URL}/model-providers`, {
      headers: { Accept: "application/json" },
    });

    return parseResponse<ModelProviderListResponse>(response);
  }
}

export async function testModelProvider(
  payload: ModelProviderTestRequest
): Promise<ModelProviderTestResponse> {
  const response = await fetch(`${API_BASE_URL}/model-providers/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<ModelProviderTestResponse>(response);
}


/* -------------------------------------------------------------------------- */
/* HexaGuard Model Registry API                                               */
/* -------------------------------------------------------------------------- */

export type RegistryModelStatus =
  | "ready"
  | "untested"
  | "needs_setup"
  | "error"
  | "connection_error"
  | "unavailable"
  | "disabled"
  | "demo_only"
  | "testing";

export type RegistryUsageScope = "manual" | "campaigns" | "both" | "disabled";

export type RegistryModel = {
  id: string;
  displayName: string;
  provider: string;
  providerId?: string;
  modelId: string;
  baseUrl?: string | null;
  status: RegistryModelStatus;
  enabled: boolean;
  usageScope: RegistryUsageScope;
  isDefault: boolean;
  capabilityType?: string;
  apiKeyConfigured: boolean;
  maskedKey?: string | null;
  lastTestedAt?: string | null;
  latencyMs?: number | null;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RegistryModelPayload = {
  display_name?: string;
  displayName?: string;
  provider?: string;
  model_id?: string;
  modelId?: string;
  base_url?: string;
  baseUrl?: string;
  api_key?: string;
  apiKey?: string;
  usage_scope?: RegistryUsageScope;
  usageScope?: RegistryUsageScope;
  enabled?: boolean;
  is_default?: boolean;
  isDefault?: boolean;
  capability_type?: string;
  capabilityType?: string;
  max_tokens?: number;
  default_temperature?: number;
  timeout_seconds?: number;
  retry_count?: number;
  notes?: string;
};

export type RegistryConnectionTestResult = {
  id: string;
  modelId: string;
  displayName: string;
  provider: string;
  status: RegistryModelStatus;
  success: boolean;
  latencyMs: number;
  message: string;
  suggestedFix: string;
  checkedAt: string;
};

function getRegistryApiBase() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
}

function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  const token = localStorage.getItem("hexaguard_access_token");

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function modelRegistryRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getRegistryApiBase()}${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    throw new Error(data?.detail || data?.message || "Model registry request failed.");
  }

  return data as T;
}

function normalizeRegistryStatus(value: unknown): RegistryModelStatus {
  const status = String(value || "untested").toLowerCase();

  if (status === "ready" || status === "connected") return "ready";
  if (status === "demo" || status === "demo_only") return "demo_only";
  if (status === "needs_api_key" || status === "needs_setup" || status === "not_configured") return "needs_setup";
  if (status === "error" || status === "connection_error") return "connection_error";
  if (status === "disabled") return "disabled";
  if (status === "unavailable") return "unavailable";
  if (status === "testing") return "testing";

  return "untested";
}

function normalizeUsageScope(value: unknown): RegistryUsageScope {
  const usage = String(value || "both").toLowerCase();

  if (usage === "manual") return "manual";
  if (usage === "campaigns" || usage === "campaign") return "campaigns";
  if (usage === "disabled") return "disabled";

  return "both";
}

export function normalizeRegistryModel(item: any): RegistryModel {
  return {
    id: String(item.id || item.model_id || item.modelId || crypto.randomUUID()),
    displayName: String(item.display_name || item.displayName || item.name || item.label || "Unnamed model"),
    provider: String(item.provider || item.provider_type || item.providerType || "custom"),
    providerId: item.provider_id || item.providerId,
    modelId: String(item.model_id || item.modelId || item.value || ""),
    baseUrl: item.base_url ?? item.baseUrl ?? null,
    status: normalizeRegistryStatus(item.status),
    enabled: item.enabled ?? item.is_active ?? true,
    usageScope: normalizeUsageScope(item.usage_scope || item.usageScope),
    isDefault: Boolean(item.is_default || item.isDefault),
    capabilityType: item.capability_type || item.capabilityType || "chat",
    apiKeyConfigured: Boolean(item.api_key_configured || item.apiKeyConfigured || item.masked_key || item.maskedKey),
    maskedKey: item.masked_key ?? item.maskedKey ?? null,
    lastTestedAt: item.last_tested_at ?? item.lastTestedAt ?? null,
    latencyMs: item.latency_ms ?? item.latencyMs ?? null,
    lastError: item.last_error ?? item.lastError ?? null,
    createdAt: item.created_at ?? item.createdAt,
    updatedAt: item.updated_at ?? item.updatedAt,
  };
}

export async function listRegistryModels(params?: {
  provider?: string;
  status?: string;
  usage?: string;
  q?: string;
}) {
  const query = new URLSearchParams();

  if (params?.provider && params.provider !== "all") query.set("provider", params.provider);
  if (params?.status && params.status !== "all") query.set("status", params.status);
  if (params?.usage && params.usage !== "all") query.set("usage", params.usage);
  if (params?.q) query.set("q", params.q);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  const payload = await modelRegistryRequest<any>(`/models${suffix}`);

  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.models)
        ? payload.models
        : [];

  return {
    total: Number(payload.total ?? items.length),
    items: items.map(normalizeRegistryModel),
  };
}

export async function createRegistryModel(payload: RegistryModelPayload) {
  const response = await modelRegistryRequest<any>("/models", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeRegistryModel(response);
}

export async function updateRegistryModel(modelId: string, payload: RegistryModelPayload) {
  const response = await modelRegistryRequest<any>(`/models/${encodeURIComponent(modelId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return normalizeRegistryModel(response);
}

export async function deleteRegistryModel(modelId: string) {
  return modelRegistryRequest<{ deleted: boolean; id: string }>(`/models/${encodeURIComponent(modelId)}`, {
    method: "DELETE",
  });
}

export async function testRegistryModel(modelId: string): Promise<RegistryConnectionTestResult> {
  const result = await modelRegistryRequest<any>(`/models/${encodeURIComponent(modelId)}/test`, {
    method: "POST",
  });

  return {
    id: String(result.id || `${modelId}-${Date.now()}`),
    modelId: String(result.modelId || result.model_id || modelId),
    displayName: String(result.displayName || result.display_name || result.modelId || result.model_id || modelId),
    provider: String(result.provider || "custom"),
    status: normalizeRegistryStatus(result.status),
    success: Boolean(result.success),
    latencyMs: Number(result.latencyMs || result.latency_ms || 0),
    message: String(result.message || "Connection test completed."),
    suggestedFix: String(result.suggestedFix || result.suggested_fix || "No action required."),
    checkedAt: String(result.checkedAt || result.checked_at || new Date().toISOString()),
  };
}

export async function setDefaultRegistryModel(modelId: string) {
  const response = await modelRegistryRequest<any>(`/models/${encodeURIComponent(modelId)}/set-default`, {
    method: "POST",
  });

  return normalizeRegistryModel(response);
}


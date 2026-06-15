"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CampaignModelOption,
  ModelProviderStatus,
  getModelProviders,
  testModelProvider,
} from "@/lib/modelProviderApi";

type ProviderName =
  | "mock"
  | "openai"
  | "groq"
  | "ollama"
  | "lmstudio"
  | "custom"
  | string;

type ModelStatus =
  | "ready"
  | "untested"
  | "needs_setup"
  | "connection_error"
  | "unavailable"
  | "disabled"
  | "demo_only"
  | "testing";

type UsageScope = "manual" | "campaigns" | "both" | "disabled";

type RegistryModel = {
  id: string;
  displayName: string;
  provider: ProviderName;
  modelId: string;
  baseUrl?: string;
  status: ModelStatus;
  enabled: boolean;
  usageScope: UsageScope;
  isDefault: boolean;
  lastTestedAt?: string;
  latencyMs?: number;
  lastError?: string;
  apiKeyConfigured: boolean;
  maskedKey?: string;
  createdAt: string;
  updatedAt: string;
  source: "backend" | "provider" | "local";
};

type ModelFormState = {
  id?: string;
  displayName: string;
  provider: ProviderName;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  maskedKey: string;
  usageScope: UsageScope;
  enabled: boolean;
  isDefault: boolean;
};

type ConnectionCheck = {
  id: string;
  modelId: string;
  displayName: string;
  provider: ProviderName;
  status: ModelStatus;
  success: boolean;
  message: string;
  suggestedFix: string;
  latencyMs: number;
  checkedAt: string;
};

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");

const MODEL_STORAGE_KEY = "hexaguard_model_registry";
const READY_MODELS_STORAGE_KEY = "hexaguard_ready_models";
const DEFAULT_MODEL_STORAGE_KEY = "hexaguard_default_model";

const PROVIDERS = [
  { value: "mock", label: "Mock", helper: "Demo provider." },
  { value: "openai", label: "OpenAI", helper: "Hosted provider." },
  { value: "groq", label: "Groq", helper: "Hosted provider." },
  { value: "ollama", label: "Ollama", helper: "Local provider." },
  { value: "lmstudio", label: "LM Studio", helper: "Local provider." },
  { value: "custom", label: "Custom", helper: "OpenAI-compatible." },
];

const DEFAULT_FORM: ModelFormState = {
  displayName: "",
  provider: "mock",
  modelId: "",
  baseUrl: "",
  apiKey: "",
  maskedKey: "",
  usageScope: "both",
  enabled: true,
  isDefault: false,
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeProvider(provider: string): ProviderName {
  const value = String(provider || "").toLowerCase();

  if (value.includes("openai")) return "openai";
  if (value.includes("groq")) return "groq";
  if (value.includes("ollama")) return "ollama";
  if (value.includes("lmstudio") || value.includes("lm studio")) return "lmstudio";
  if (value.includes("mock")) return "mock";
  if (value.includes("custom")) return "custom";

  return value || "custom";
}

function providerLabel(provider: string) {
  return (
    PROVIDERS.find((item) => item.value === normalizeProvider(provider))?.label ||
    provider ||
    "Unknown"
  );
}

function formatDate(value?: string) {
  if (!value) return "Not tested";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function formatTime(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function maskApiKey(value: string) {
  const clean = value.trim();

  if (!clean) return "";
  if (clean.length <= 8) return "••••••••";

  return `${clean.slice(0, 3)}••••••••${clean.slice(-4)}`;
}

function usageLabel(value: UsageScope) {
  if (value === "both") return "Manual + Campaigns";
  if (value === "manual") return "Manual only";
  if (value === "campaigns") return "Campaigns only";
  return "Disabled";
}

function statusLabel(status: ModelStatus) {
  switch (status) {
    case "ready":
      return "Ready";
    case "untested":
      return "Untested";
    case "needs_setup":
      return "Needs Setup";
    case "connection_error":
      return "Connection Error";
    case "unavailable":
      return "Unavailable";
    case "disabled":
      return "Disabled";
    case "demo_only":
      return "Demo Only";
    case "testing":
      return "Testing";
    default:
      return "Unknown";
  }
}

function statusTone(status: ModelStatus) {
  if (status === "ready") return "success";
  if (status === "demo_only" || status === "testing") return "info";
  if (status === "untested" || status === "needs_setup") return "warning";
  if (status === "disabled") return "muted";

  return "danger";
}

function isReadyForTesting(model: RegistryModel) {
  return model.enabled && (model.status === "ready" || model.status === "demo_only");
}

function needsAttention(model: RegistryModel) {
  return !isReadyForTesting(model);
}

function defaultBaseUrl(provider: ProviderName) {
  if (provider === "ollama") return "http://localhost:11434";
  if (provider === "lmstudio") return "http://localhost:1234/v1";
  return "";
}

function initialStatusFromForm(form: ModelFormState): ModelStatus {
  if (!form.enabled || form.usageScope === "disabled") return "disabled";
  if (form.provider === "mock") return "demo_only";

  const needsHostedKey = form.provider === "openai" || form.provider === "groq";
  const needsBaseUrl =
    form.provider === "ollama" || form.provider === "lmstudio" || form.provider === "custom";

  if (needsHostedKey && !form.apiKey && !form.maskedKey) return "needs_setup";
  if (needsBaseUrl && !form.baseUrl) return "needs_setup";

  return "untested";
}

function friendlyConnectionMessage(message: string, success: boolean) {
  const lower = message.toLowerCase();

  if (success) {
    return {
      message: "Connected successfully.",
      suggestedFix: "No action required. This model can be used in enabled workflows.",
    };
  }

  if (lower.includes("401") || lower.includes("auth") || lower.includes("key")) {
    return {
      message: "Invalid or expired API key.",
      suggestedFix: "Replace the provider API key and test the connection again.",
    };
  }

  if (lower.includes("404") || lower.includes("not found")) {
    return {
      message: "Model not found.",
      suggestedFix: "Verify the model identifier and provider name.",
    };
  }

  if (lower.includes("timeout")) {
    return {
      message: "Provider did not respond before timeout.",
      suggestedFix: "Check provider availability or network connectivity.",
    };
  }

  if (lower.includes("refused") || lower.includes("unreachable") || lower.includes("failed to fetch")) {
    return {
      message: "Provider unavailable.",
      suggestedFix: "For local providers, make sure Ollama or LM Studio is running.",
    };
  }

  if (lower.includes("url") || lower.includes("invalid")) {
    return {
      message: "Invalid provider configuration.",
      suggestedFix: "Check the base URL, model identifier, and provider credentials.",
    };
  }

  return {
    message: message || "Connection failed.",
    suggestedFix: "Review provider configuration, then test again.",
  };
}

async function backendRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("hexaguard_access_token")
      : null;

  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(init?.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw new Error(data?.detail || data?.message || "Backend request failed.");
  }

  return data as T;
}

function extractList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;

  for (const key of ["items", "data", "results", "models"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }

  for (const key of ["items", "data", "results", "models"]) {
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }

  return [];
}

function mapBackendStatus(value: string, enabled = true, lastTestedAt?: string): ModelStatus {
  const status = String(value || "").toLowerCase();

  if (!enabled || status === "disabled") return "disabled";
  if (status === "demo_only" || status === "demo") return "demo_only";
  if (status === "ready" || status === "connected") return lastTestedAt ? "ready" : "untested";
  if (status === "needs_api_key" || status === "not_configured" || status === "needs_setup") return "needs_setup";
  if (status === "connection_error" || status === "error") return "connection_error";
  if (status === "unavailable") return "unavailable";
  if (status === "testing") return "testing";
  if (status === "untested" || status === "needs_test") return "untested";

  return "untested";
}

function mapUsage(value: string): UsageScope {
  const usage = String(value || "").toLowerCase();

  if (usage === "manual") return "manual";
  if (usage === "campaigns" || usage === "campaign") return "campaigns";
  if (usage === "disabled") return "disabled";

  return "both";
}

function normalizeBackendModel(item: any, index: number): RegistryModel {
  const provider = normalizeProvider(item.provider || item.provider_name || "custom");
  const enabled = item.enabled !== false;
  const lastTestedAt = item.last_tested_at || item.lastTestedAt || item.last_tested || "";

  return {
    id: String(item.id || item.model_config_id || item.model_id || `${provider}-${index}`),
    displayName: String(item.display_name || item.displayName || item.name || item.label || "Unnamed model"),
    provider,
    modelId: String(item.model_id || item.modelId || item.identifier || item.value || ""),
    baseUrl: item.base_url || item.baseUrl || "",
    status: mapBackendStatus(item.status, enabled, lastTestedAt),
    enabled,
    usageScope: mapUsage(item.usage_scope || item.usageScope || item.usage_mode),
    isDefault: Boolean(item.is_default || item.isDefault),
    lastTestedAt,
    latencyMs: Number(item.latency_ms || item.latencyMs || 0) || undefined,
    lastError: item.last_error || item.lastError || "",
    apiKeyConfigured: Boolean(item.api_key_configured || item.apiKeyConfigured || item.masked_key || item.maskedKey),
    maskedKey: item.masked_key || item.maskedKey || "",
    createdAt: item.created_at || item.createdAt || nowIso(),
    updatedAt: item.updated_at || item.updatedAt || nowIso(),
    source: "backend",
  };
}

function mapCampaignModel(item: CampaignModelOption, index: number): RegistryModel {
  const provider = normalizeProvider(item.provider);

  return {
    id: item.value || `${provider}-${index}`,
    displayName: item.label || item.value || "Unnamed model",
    provider,
    modelId: item.value || "",
    baseUrl: defaultBaseUrl(provider),
    status:
      provider === "mock"
        ? "demo_only"
        : item.configured
          ? "untested"
          : "needs_setup",
    enabled: item.available_for_campaigns,
    usageScope: "both",
    isDefault: index === 0,
    lastTestedAt: "",
    latencyMs: undefined,
    lastError: item.configured || provider === "mock" ? "" : "Provider configuration is incomplete.",
    apiKeyConfigured: item.configured,
    maskedKey: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    source: "provider",
  };
}

function loadLocalModels(): RegistryModel[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(MODEL_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item, index) => ({
      ...normalizeBackendModel(item, index),
      source: "local" as const,
    }));
  } catch {
    return [];
  }
}

function saveLocalModels(models: RegistryModel[]) {
  if (typeof window === "undefined") return;

  const safeModels = models.map((model) => ({
    ...model,
    maskedKey: model.maskedKey || "",
    apiKeyConfigured: model.apiKeyConfigured,
  }));

  const readyModels = safeModels.filter(isReadyForTesting);

  localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(safeModels));
  localStorage.setItem(READY_MODELS_STORAGE_KEY, JSON.stringify(readyModels));

  const defaultModel = readyModels.find((model) => model.isDefault) || readyModels[0];

  if (defaultModel) {
    localStorage.setItem(DEFAULT_MODEL_STORAGE_KEY, defaultModel.modelId);
  } else {
    localStorage.removeItem(DEFAULT_MODEL_STORAGE_KEY);
  }
}

function mergeById(models: RegistryModel[]) {
  return Array.from(new Map(models.map((model) => [model.id, model])).values());
}

function Badge({ status }: { status: ModelStatus }) {
  const tone = statusTone(status);

  const className =
    tone === "success"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
      : tone === "info"
        ? "border-cyan-400/25 bg-cyan-500/10 text-cyan-300"
        : tone === "warning"
          ? "border-amber-400/25 bg-amber-500/10 text-amber-300"
          : tone === "muted"
            ? "border-white/[0.08] bg-white/[0.04] text-[#a9a9a9]"
            : "border-red-400/25 bg-red-500/10 text-red-300";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${className}`}>
      {statusLabel(status)}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const className =
    tone === "success"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
      : tone === "warning"
        ? "border-amber-400/20 bg-amber-500/10 text-amber-300"
        : tone === "danger"
          ? "border-red-400/20 bg-red-500/10 text-red-300"
          : tone === "info"
            ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-300"
            : "border-white/[0.06] bg-[#27292a] text-white";

  return (
    <article className={`rounded-[18px] border p-4 shadow-[0_16px_35px_rgba(0,0,0,0.16)] ${className}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">
        {label}
      </p>
      <p className="mt-2 truncate text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs leading-5 opacity-70">{helper}</p>
    </article>
  );
}

function ProviderCard({
  provider,
  count,
  readyCount,
  onConfigure,
}: {
  provider: { value: string; label: string; helper?: string; configured?: boolean };
  count: number;
  readyCount: number;
  onConfigure: () => void;
}) {
  const configured = Boolean(provider.configured || count > 0);

  return (
    <article className="rounded-[18px] border border-white/[0.06] bg-[#27292a] p-4 shadow-[0_16px_35px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-white">{provider.label}</h3>
          <p className="mt-1 text-xs text-[#8a8a8a]">{provider.helper || "Provider setup"}</p>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-black ${
            configured
              ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
              : "border-amber-400/25 bg-amber-500/10 text-amber-300"
          }`}
        >
          {configured ? "Configured" : "Needs Setup"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[14px] border border-white/[0.06] bg-[#1f2122] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">Models</p>
          <p className="mt-1 text-xl font-black text-white">{count}</p>
        </div>

        <div className="rounded-[14px] border border-white/[0.06] bg-[#1f2122] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">Ready</p>
          <p className="mt-1 text-xl font-black text-emerald-300">{readyCount}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onConfigure}
        className="mt-4 rounded-full border border-[#4ad7ff]/30 px-4 py-2 text-xs font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10"
      >
        Configure
      </button>
    </article>
  );
}

function ModelFormModal({
  mode,
  form,
  setForm,
  onClose,
  onSave,
  onSaveAndTest,
  saving,
  testing,
  validationErrors,
  testResult,
}: {
  mode: "add" | "edit";
  form: ModelFormState;
  setForm: (form: ModelFormState) => void;
  onClose: () => void;
  onSave: () => void;
  onSaveAndTest: () => void;
  saving: boolean;
  testing?: boolean;
  validationErrors?: Record<string, string>;
  testResult?: ConnectionCheck | null;
}) {
  const provider = normalizeProvider(form.provider);
  const isMock = provider === "mock";
  const requiresApiKey = provider === "openai" || provider === "groq";
  const requiresBaseUrl =
    provider === "ollama" || provider === "lmstudio" || provider === "custom";
  const showBaseUrl = !isMock;
  const showApiKey = !isMock && provider !== "ollama";

  const hasStoredKey = Boolean(form.maskedKey);
  const title = mode === "edit" ? `Editing: ${form.displayName || "Target Model"}` : "New Target Model";

  const errorFor = (field: string) =>
    validationErrors?.[field] ? (
      <p className="mt-2 text-xs font-bold text-red-300">{validationErrors[field]}</p>
    ) : null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-xl">
      <section className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#202323] shadow-[0_30px_100px_rgba(0,0,0,0.62)]">
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] bg-[#27292a] px-6 py-5">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.28em] text-[#4ad7ff]">
              Model Configuration
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#a9a9a9]">
              Configure target models used by Manual Red Teaming and Campaigns.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-[12px] border border-white/[0.08] bg-[#1f2122] text-lg font-black text-white transition hover:border-red-400/40 hover:text-red-300"
            aria-label="Close model configuration"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <section className="rounded-[18px] border border-white/[0.06] bg-[#1f2122] p-5">
            <div className="mb-4">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-[#4ad7ff]">
                Basic Information
              </p>
              <p className="mt-1 text-xs text-[#8a8a8a]">
                Name the model and choose its provider.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                  Display Name
                </span>
                <input
                  value={form.displayName}
                  onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                  className="mt-2 h-11 w-full rounded-[14px] border border-white/[0.06] bg-[#27292a] px-4 text-sm text-white outline-none placeholder:text-[#727272] focus:border-[#4ad7ff]/70"
                  placeholder="Groq Llama 3.3 70B"
                />
                {errorFor("displayName")}
              </label>

              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                  Provider
                </span>
                <select
                  value={form.provider}
                  onChange={(event) => {
                    const nextProvider = normalizeProvider(event.target.value);
                    setForm({
                      ...form,
                      provider: nextProvider,
                      baseUrl: defaultBaseUrl(nextProvider),
                      apiKey: "",
                    });
                  }}
                  className="mt-2 h-11 w-full rounded-[14px] border border-white/[0.06] bg-[#27292a] px-4 text-sm text-white outline-none focus:border-[#4ad7ff]/70"
                >
                  {PROVIDERS.map((providerOption) => (
                    <option key={providerOption.value} value={providerOption.value}>
                      {providerOption.label}
                    </option>
                  ))}
                </select>
                {errorFor("provider")}
              </label>

              <label className="md:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                  Model ID
                </span>
                <input
                  value={form.modelId}
                  onChange={(event) => setForm({ ...form, modelId: event.target.value })}
                  className="mt-2 h-11 w-full rounded-[14px] border border-white/[0.06] bg-[#27292a] px-4 font-mono text-sm text-white outline-none placeholder:text-[#727272] focus:border-[#4ad7ff]/70"
                  placeholder={isMock ? "mock:mock-safe-model" : "llama-3.3-70b-versatile"}
                />
                {errorFor("modelId")}
              </label>
            </div>
          </section>

          <section className="mt-4 rounded-[18px] border border-white/[0.06] bg-[#1f2122] p-5">
            <div className="mb-4">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-[#4ad7ff]">
                Connection Settings
              </p>
              <p className="mt-1 text-xs text-[#8a8a8a]">
                Provider-specific settings. Full API keys are never displayed.
              </p>
            </div>

            {isMock ? (
              <div className="rounded-[14px] border border-cyan-400/15 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-200">
                Mock provider does not require a base URL or API key.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {showBaseUrl ? (
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                      Base URL {requiresBaseUrl ? "(required)" : "(optional)"}
                    </span>
                    <input
                      value={form.baseUrl}
                      onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
                      className="mt-2 h-11 w-full rounded-[14px] border border-white/[0.06] bg-[#27292a] px-4 text-sm text-white outline-none placeholder:text-[#727272] focus:border-[#4ad7ff]/70"
                      placeholder={defaultBaseUrl(provider) || "https://api.provider.com/v1"}
                    />
                    {errorFor("baseUrl")}
                  </label>
                ) : null}

                {showApiKey ? (
                  <label className={showBaseUrl ? "" : "md:col-span-2"}>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                      API Key {requiresApiKey ? "(required)" : "(optional)"}
                    </span>
                    <input
                      value={form.apiKey}
                      type="password"
                      onChange={(event) =>
                        setForm({
                          ...form,
                          apiKey: event.target.value,
                          maskedKey: event.target.value ? maskApiKey(event.target.value) : form.maskedKey,
                        })
                      }
                      className="mt-2 h-11 w-full rounded-[14px] border border-white/[0.06] bg-[#27292a] px-4 text-sm text-white outline-none placeholder:text-[#727272] focus:border-[#4ad7ff]/70"
                      placeholder={hasStoredKey ? "Leave blank to keep existing key" : "Enter API key"}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-full border px-3 py-1 font-black ${
                          hasStoredKey
                            ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                            : "border-amber-400/20 bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {hasStoredKey ? "Configured" : "Not configured"}
                      </span>
                      <span className="text-[#727272]">
                        API keys are stored securely and never displayed.
                      </span>
                    </div>
                    {errorFor("apiKey")}
                  </label>
                ) : (
                  <div className="rounded-[14px] border border-white/[0.06] bg-[#27292a] p-4 text-sm font-bold text-[#a9a9a9]">
                    API key is usually not required for this provider.
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="mt-4 rounded-[18px] border border-white/[0.06] bg-[#1f2122] p-5">
            <div className="mb-4">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-[#4ad7ff]">
                Availability
              </p>
              <p className="mt-1 text-xs text-[#8a8a8a]">
                Control where this model can be used.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                  Usage Scope
                </span>
                <select
                  value={form.usageScope}
                  onChange={(event) => setForm({ ...form, usageScope: event.target.value as UsageScope })}
                  className="mt-2 h-11 w-full rounded-[14px] border border-white/[0.06] bg-[#27292a] px-4 text-sm text-white outline-none focus:border-[#4ad7ff]/70"
                >
                  <option value="both">Manual + Campaigns</option>
                  <option value="manual">Manual only</option>
                  <option value="campaigns">Campaigns only</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>

              <div className="grid gap-3">
                <label className="flex items-center gap-2 rounded-[14px] border border-white/[0.06] bg-[#27292a] px-4 py-3 text-sm font-bold text-[#d4d4d4]">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
                  />
                  Enabled
                </label>

                <label className="flex items-center gap-2 rounded-[14px] border border-white/[0.06] bg-[#27292a] px-4 py-3 text-sm font-bold text-[#d4d4d4]">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
                  />
                  Set as Default
                </label>
                {errorFor("isDefault")}
              </div>
            </div>
          </section>

          {testResult ? (
            <section
              className={`mt-4 rounded-[18px] border p-5 ${
                testResult.success
                  ? "border-emerald-400/20 bg-emerald-500/10"
                  : "border-red-400/20 bg-red-500/10"
              }`}
            >
              <p
                className={`text-[10px] font-black uppercase tracking-[0.22em] ${
                  testResult.success ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {testResult.success ? "Connection Test Passed" : "Connection Test Failed"}
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                    Provider
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">{providerLabel(testResult.provider)}</p>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                    Model
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold text-white">{testResult.modelId}</p>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                    Latency
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">{testResult.latencyMs} ms</p>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                    Last Tested
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">{formatDate(testResult.checkedAt)}</p>
                </div>
              </div>

              <p className="mt-4 text-sm font-bold text-white">{testResult.message}</p>
              {!testResult.success ? (
                <p className="mt-2 text-sm text-red-100">{testResult.suggestedFix}</p>
              ) : null}
            </section>
          ) : null}
        </div>

        <footer className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-white/[0.08] bg-[#27292a] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/[0.08] px-5 py-3 text-sm font-black text-[#d4d4d4] transition hover:bg-white/[0.04]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving || testing}
            className="rounded-full border border-[#4ad7ff]/35 px-5 py-3 text-sm font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Model
          </button>

          <button
            type="button"
            onClick={onSaveAndTest}
            disabled={saving || testing}
            className="rounded-full bg-[#ff3434] px-6 py-3 text-sm font-black text-white transition hover:bg-[#ff4545] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testing ? "Testing..." : "Save & Test Connection"}
          </button>
        </footer>
      </section>
    </div>
  );
}



function DetailsModal({
  model,
  onClose,
  onTest,
  onEdit,
  onDefault,
  onToggle,
}: {
  model: RegistryModel;
  onClose: () => void;
  onTest: () => void;
  onEdit: () => void;
  onDefault: () => void;
  onToggle: () => void;
}) {
  const details = [
    ["Provider", providerLabel(model.provider)],
    ["Model ID", model.modelId],
    ["Base URL", model.baseUrl || "Not required"],
    ["Status", statusLabel(model.status)],
    ["Usage Scope", usageLabel(model.usageScope)],
    ["Default", model.isDefault ? "Yes" : "No"],
    ["Enabled", model.enabled ? "Yes" : "No"],
    ["API Key", model.apiKeyConfigured ? "Configured" : "Not configured"],
    ["Last Tested", formatDate(model.lastTestedAt)],
    ["Latency", model.latencyMs ? `${model.latencyMs} ms` : "Not available"],
    ["Last Error", model.lastError || "None"],
    ["Updated At", formatDate(model.updatedAt)],
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-xl">
      <section className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#202323] shadow-[0_30px_100px_rgba(0,0,0,0.62)]">
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] bg-[#27292a] px-6 py-5">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
              Model Details
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">{model.displayName}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge status={model.status} />
              <span className="rounded-full border border-white/[0.08] bg-[#1f2122] px-3 py-1 text-[11px] font-black text-[#d4d4d4]">
                {providerLabel(model.provider)}
              </span>
              {model.isDefault ? (
                <span className="rounded-full border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-3 py-1 text-[11px] font-black text-[#4ad7ff]">
                  Default
                </span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-white/[0.08] bg-[#1f2122] text-lg font-black text-white transition hover:border-red-400/40 hover:text-red-300"
            aria-label="Close model details"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 md:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-[15px] border border-white/[0.06] bg-[#1f2122] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                  {label}
                </p>
                <p
                  title={value}
                  className="mt-2 truncate text-sm font-bold text-white"
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-white/[0.08] bg-[#27292a] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/[0.08] px-5 py-3 text-sm font-black text-[#d4d4d4] transition hover:bg-white/[0.04]"
          >
            Close
          </button>

          <button
            type="button"
            onClick={onTest}
            className="rounded-full border border-[#4ad7ff]/35 px-5 py-3 text-sm font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10"
          >
            Test Connection
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="rounded-full border border-white/[0.08] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.04]"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={onDefault}
            className="rounded-full border border-emerald-400/25 px-5 py-3 text-sm font-black text-emerald-300 transition hover:bg-emerald-500/10"
          >
            Set Default
          </button>

          <button
            type="button"
            onClick={onToggle}
            className="rounded-full bg-[#ff3434] px-6 py-3 text-sm font-black text-white transition hover:bg-[#ff4545]"
          >
            {model.enabled ? "Disable" : "Enable"}
          </button>
        </footer>
      </section>
    </div>
  );
}



function ConnectionModal({
  result,
  onClose,
  onTestAgain,
  onEditConfiguration,
}: {
  result: ConnectionCheck;
  onClose: () => void;
  onTestAgain?: () => void;
  onEditConfiguration?: () => void;
}) {
  const isAggregate = result.modelId === "all";
  const isSuccess = result.success;

  const details = [
    ["Provider", isAggregate ? "Multiple providers" : providerLabel(result.provider)],
    ["Model", isAggregate ? "All enabled/configured models" : result.modelId],
    ["Latency", `${result.latencyMs} ms`],
    ["Last Tested", formatDate(result.checkedAt)],
  ];

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-xl">
      <section className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#202323] shadow-[0_30px_100px_rgba(0,0,0,0.62)]">
        <header className="border-b border-white/[0.08] bg-[#27292a] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
                Connection Test Result
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Badge status={result.status} />
                <h2 className="text-2xl font-black text-white">
                  {isSuccess ? "Connected Successfully" : "Connection Failed"}
                </h2>
              </div>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#a9a9a9]">
                {isSuccess
                  ? isAggregate
                    ? "Connection checks completed. Review the Activity Log for individual results."
                    : "This model is ready for Manual Red Teaming and Campaigns."
                  : result.message}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-white/[0.08] bg-[#1f2122] text-lg font-black text-white transition hover:border-red-400/40 hover:text-red-300"
              aria-label="Close connection result"
            >
              ×
            </button>
          </div>
        </header>

        <div className="px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-[15px] border border-white/[0.06] bg-[#1f2122] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                  {label}
                </p>
                <p title={value} className="mt-2 truncate text-sm font-bold text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div
            className={`mt-4 rounded-[16px] border p-4 ${
              isSuccess
                ? "border-emerald-400/20 bg-emerald-500/10"
                : "border-red-400/25 bg-red-500/10"
            }`}
          >
            <p className={`text-sm font-black ${isSuccess ? "text-emerald-200" : "text-red-100"}`}>
              {isSuccess ? "No action required." : "Suggested Fix"}
            </p>
            <p className={`mt-1 text-sm leading-6 ${isSuccess ? "text-emerald-100" : "text-red-50"}`}>
              {isSuccess
                ? result.suggestedFix || "This model can be used in enabled workflows."
                : result.suggestedFix}
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-white/[0.08] bg-[#27292a] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/[0.08] px-5 py-3 text-sm font-black text-[#d4d4d4] transition hover:bg-white/[0.04]"
          >
            Close
          </button>

          {!isAggregate && onTestAgain ? (
            <button
              type="button"
              onClick={onTestAgain}
              className="rounded-full border border-[#4ad7ff]/35 px-5 py-3 text-sm font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10"
            >
              Test Again
            </button>
          ) : null}

          {!isSuccess && !isAggregate && onEditConfiguration ? (
            <button
              type="button"
              onClick={onEditConfiguration}
              className="rounded-full bg-[#ff3434] px-6 py-3 text-sm font-black text-white transition hover:bg-[#ff4545]"
            >
              Edit Configuration
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}



export default function ModelSettingsPage() {
  const [providers, setProviders] = useState<ModelProviderStatus[]>([]);
  const [models, setModels] = useState<RegistryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [usageFilter, setUsageFilter] = useState("all");

  const [form, setForm] = useState<ModelFormState>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [modalTestResult, setModalTestResult] = useState<ConnectionCheck | null>(null);
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [detailsModel, setDetailsModel] = useState<RegistryModel | null>(null);
  const [connectionResult, setConnectionResult] = useState<ConnectionCheck | null>(null);
  const [connectionChecks, setConnectionChecks] = useState<ConnectionCheck[]>([]);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testAllProgress, setTestAllProgress] = useState<{ current: number; total: number } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const ready = models.filter(isReadyForTesting).length;
    const attention = models.filter(needsAttention).length;
    const defaultModel = models.find((model) => model.isDefault);

    return {
      total: models.length,
      ready,
      attention,
      defaultModel: defaultModel?.displayName || "Not set",
    };
  }, [models]);

  const providerCards = useMemo(() => {
    const backendProviders =
      providers.length > 0
        ? providers.map((provider) => ({
            value: normalizeProvider(provider.provider),
            label: provider.label || providerLabel(provider.provider),
            helper: "Backend provider",
            configured: provider.configured,
          }))
        : [];

    const combined = [...backendProviders];

    for (const option of PROVIDERS) {
      if (!combined.some((provider) => provider.value === option.value)) {
        combined.push({ ...option, configured: false });
      }
    }

    return combined;
  }, [providers]);

  const providerCounts = useMemo(() => {
    return models.reduce<Record<string, { total: number; ready: number }>>((acc, model) => {
      const key = normalizeProvider(model.provider);

      if (!acc[key]) acc[key] = { total: 0, ready: 0 };

      acc[key].total += 1;

      if (isReadyForTesting(model)) {
        acc[key].ready += 1;
      }

      return acc;
    }, {});
  }, [models]);

  const filteredModels = useMemo(() => {
    const search = query.trim().toLowerCase();

    return models.filter((model) => {
      const matchesQuery =
        !search ||
        model.displayName.toLowerCase().includes(search) ||
        model.modelId.toLowerCase().includes(search) ||
        providerLabel(model.provider).toLowerCase().includes(search);

      const matchesProvider =
        providerFilter === "all" || normalizeProvider(model.provider) === providerFilter;

      const matchesStatus = statusFilter === "all" || model.status === statusFilter;
      const matchesUsage = usageFilter === "all" || model.usageScope === usageFilter;

      return matchesQuery && matchesProvider && matchesStatus && matchesUsage;
    });
  }, [models, providerFilter, query, statusFilter, usageFilter]);

  async function loadModels() {
    setLoading(true);
    setErrorMessage("");

    try {
      let backendModels: RegistryModel[] = [];

      try {
        const modelsPayload = await backendRequest<any>("/models");
        backendModels = extractList(modelsPayload).map(normalizeBackendModel);
      } catch {
        backendModels = [];
      }

      let providerModels: RegistryModel[] = [];

      try {
        const providerPayload = await getModelProviders();
        setProviders(providerPayload.providers || []);
        providerModels = (providerPayload.campaign_models || []).map(mapCampaignModel);
      } catch {
        providerModels = [];
      }

      const localModels = loadLocalModels();
      const merged = mergeById([...providerModels, ...backendModels, ...localModels]);

      if (merged.length === 0) {
        setErrorMessage("No models were returned. Add a target model to start testing.");
      }

      setModels(merged);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load models. Check backend connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function openAddModal(provider: ProviderName = "mock") {
    const normalizedProvider = normalizeProvider(provider);

    setForm({
      ...DEFAULT_FORM,
      provider: normalizedProvider,
      baseUrl: defaultBaseUrl(normalizedProvider),
    });
    setFormErrors({});
    setModalTestResult(null);
    setModalMode("add");
  }

  function openEditModal(model: RegistryModel) {
    setForm({
      id: model.id,
      displayName: model.displayName,
      provider: model.provider,
      modelId: model.modelId,
      baseUrl: model.baseUrl || "",
      apiKey: "",
      maskedKey: model.maskedKey || "",
      usageScope: model.usageScope,
      enabled: model.enabled,
      isDefault: model.isDefault,
    });
    setFormErrors({});
    setModalTestResult(null);
    setModalMode("edit");
  }


  function validateForm() {
    const errors: Record<string, string> = {};
    const provider = normalizeProvider(form.provider);

    if (!form.displayName.trim()) {
      errors.displayName = "Display Name is required.";
    }

    if (!form.modelId.trim()) {
      errors.modelId = "Model ID is required.";
    }

    if ((provider === "openai" || provider === "groq") && !form.apiKey.trim() && !form.maskedKey) {
      errors.apiKey = `API key is required for ${providerLabel(provider)}.`;
    }

    if ((provider === "ollama" || provider === "lmstudio" || provider === "custom") && !form.baseUrl.trim()) {
      errors.baseUrl = `Base URL is required for ${providerLabel(provider)}.`;
    }

    if (form.isDefault && (!form.enabled || form.usageScope === "disabled")) {
      errors.isDefault = "A default model must be enabled and available for testing workflows.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function saveModelState(options?: { testAfterSave?: boolean }) {
    setModalTestResult(null);

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    const id = form.id || `${form.provider}:${form.modelId || form.displayName || Date.now()}`;
    const savedAt = nowIso();

    const nextModel: RegistryModel = {
      id,
      displayName: form.displayName || form.modelId || "Untitled Model",
      provider: normalizeProvider(form.provider),
      modelId: form.modelId || `${form.provider}:model`,
      baseUrl: form.baseUrl,
      status: initialStatusFromForm(form),
      enabled: form.enabled && form.usageScope !== "disabled",
      usageScope: form.enabled ? form.usageScope : "disabled",
      isDefault: form.isDefault,
      lastTestedAt: "",
      latencyMs: undefined,
      lastError: "",
      apiKeyConfigured: Boolean(form.apiKey || form.maskedKey),
      maskedKey: form.apiKey ? maskApiKey(form.apiKey) : form.maskedKey,
      createdAt: models.find((model) => model.id === id)?.createdAt || savedAt,
      updatedAt: savedAt,
      source: "local",
    };

    try {
      const payload = {
        display_name: nextModel.displayName,
        provider: nextModel.provider,
        model_id: nextModel.modelId,
        base_url: nextModel.baseUrl || undefined,
        api_key: form.apiKey || undefined,
        enabled: nextModel.enabled,
        usage_scope: nextModel.usageScope,
        is_default: nextModel.isDefault,
      };

      if (form.id) {
        await backendRequest(`/models/${encodeURIComponent(form.id)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await backendRequest("/models", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      nextModel.source = "backend";
    } catch {
      nextModel.source = "local";
    }

    setModels((current) => {
      const withoutCurrent = current.filter((model) => model.id !== id);
      const resetDefault = nextModel.isDefault
        ? withoutCurrent.map((model) => ({ ...model, isDefault: false }))
        : withoutCurrent;

      return [...resetDefault, nextModel];
    });

    setSaving(false);

    if (options?.testAfterSave) {
      await testConnection(nextModel, { inline: true });
      return;
    }

    setModalMode(null);
    setForm(DEFAULT_FORM);
    setFormErrors({});
    setModalTestResult(null);
  }

  async function testConnection(model: RegistryModel, options?: { inline?: boolean; silent?: boolean }) {
    const startedAt = performance.now();

    setTestingModelId(model.id);
    setModels((current) =>
      current.map((item) =>
        item.id === model.id ? { ...item, status: "testing" } : item
      )
    );

    try {
      let result: any = null;

      try {
        result = await backendRequest<any>(`/models/${encodeURIComponent(model.id)}/test`, {
          method: "POST",
        });
      } catch {
        result = await testModelProvider({
          provider: model.provider,
          base_url: model.baseUrl,
          model_name: model.modelId,
        });
      }

      const latencyMs = Math.round(performance.now() - startedAt);
      const success = Boolean(result.success);
      const friendly = friendlyConnectionMessage(result.message || result.status, success);

      const nextStatus: ModelStatus = success
        ? model.provider === "mock"
          ? "demo_only"
          : "ready"
        : friendly.message.includes("API key")
          ? "needs_setup"
          : friendly.message.includes("not found")
            ? "connection_error"
            : friendly.message.includes("unavailable") || friendly.message.includes("Provider")
              ? "unavailable"
              : "connection_error";

      const check: ConnectionCheck = {
        id: `${model.id}-${Date.now()}`,
        modelId: model.modelId,
        displayName: model.displayName,
        provider: model.provider,
        status: nextStatus,
        success,
        message: friendly.message,
        suggestedFix: friendly.suggestedFix,
        latencyMs,
        checkedAt: nowIso(),
      };

      if (options?.inline) {
        setModalTestResult(check);
      } else if (!options?.silent) {
        setConnectionResult(check);
      }

      setConnectionChecks((current) => [check, ...current].slice(0, 10));

      setModels((current) =>
        current.map((item) =>
          item.id === model.id
            ? {
                ...item,
                status: nextStatus,
                lastTestedAt: check.checkedAt,
                latencyMs,
                lastError: success ? "" : friendly.message,
                updatedAt: nowIso(),
              }
            : item
        )
      );
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startedAt);
      const friendly = friendlyConnectionMessage(
        error instanceof Error ? error.message : "Connection test failed.",
        false
      );

      const check: ConnectionCheck = {
        id: `${model.id}-${Date.now()}`,
        modelId: model.modelId,
        displayName: model.displayName,
        provider: model.provider,
        status: "connection_error",
        success: false,
        message: friendly.message,
        suggestedFix: friendly.suggestedFix,
        latencyMs,
        checkedAt: nowIso(),
      };

      if (options?.inline) {
        setModalTestResult(check);
      } else if (!options?.silent) {
        setConnectionResult(check);
      }

      setConnectionChecks((current) => [check, ...current].slice(0, 10));

      setModels((current) =>
        current.map((item) =>
          item.id === model.id
            ? {
                ...item,
                status: "connection_error",
                lastTestedAt: check.checkedAt,
                latencyMs,
                lastError: friendly.message,
                updatedAt: nowIso(),
              }
            : item
        )
      );
    } finally {
      setTestingModelId(null);
    }
  }

  async function testAllConnections() {
    const candidates = models.filter((model) => {
      if (!model.enabled || model.usageScope === "disabled" || model.status === "disabled") {
        return false;
      }

      const provider = normalizeProvider(model.provider);

      if (provider === "mock") return true;

      if (provider === "openai" || provider === "groq") {
        return model.apiKeyConfigured;
      }

      if (provider === "ollama" || provider === "lmstudio" || provider === "custom") {
        return Boolean(model.baseUrl);
      }

      return true;
    });

    if (candidates.length === 0) {
      setConnectionResult({
        id: `test-all-empty-${Date.now()}`,
        modelId: "all",
        displayName: "Test All Connections",
        provider: "custom",
        status: "needs_setup",
        success: false,
        message: "No enabled/configured models are available to test.",
        suggestedFix: "Enable at least one model and complete its required provider configuration.",
        latencyMs: 0,
        checkedAt: nowIso(),
      });
      return;
    }

    const confirmed = window.confirm(
      `Test all enabled/configured model connections? This will run ${candidates.length} connection check${candidates.length === 1 ? "" : "s"}.`
    );

    if (!confirmed) return;

    const startedAt = performance.now();
    setTestAllProgress({ current: 0, total: candidates.length });

    for (let index = 0; index < candidates.length; index += 1) {
      setTestAllProgress({ current: index + 1, total: candidates.length });
      await testConnection(candidates[index], { silent: true });
    }

    setTestAllProgress(null);

    setConnectionResult({
      id: `test-all-complete-${Date.now()}`,
      modelId: "all",
      displayName: "Test All Connections",
      provider: "custom",
      status: "ready",
      success: true,
      message: `Connection checks completed for ${candidates.length} model${candidates.length === 1 ? "" : "s"}.`,
      suggestedFix: "Review the Activity Log for individual model results.",
      latencyMs: Math.round(performance.now() - startedAt),
      checkedAt: nowIso(),
    });
  }



  async function setDefaultModel(model: RegistryModel) {
    if (!isReadyForTesting(model)) {
      setConnectionResult({
        id: `default-${Date.now()}`,
        modelId: model.modelId,
        displayName: model.displayName,
        provider: model.provider,
        status: model.status,
        success: false,
        message: "Only ready models can be set as default.",
        suggestedFix: "Test the connection successfully or enable the model before setting it as default.",
        latencyMs: 0,
        checkedAt: nowIso(),
      });
      return;
    }

    try {
      await backendRequest(`/models/${encodeURIComponent(model.id)}/set-default`, {
        method: "POST",
      });
    } catch {
      // Backend endpoint may not exist yet. UI state still updates.
    }

    setModels((current) =>
      current.map((item) => ({
        ...item,
        isDefault: item.id === model.id,
        updatedAt: item.id === model.id ? nowIso() : item.updatedAt,
      }))
    );
  }

  async function toggleModel(model: RegistryModel) {
    const nextEnabled = !model.enabled;
    const nextStatus: ModelStatus = nextEnabled
      ? model.status === "disabled"
        ? "untested"
        : model.status
      : "disabled";

    try {
      await backendRequest(`/models/${encodeURIComponent(model.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          enabled: nextEnabled,
          usage_scope: nextEnabled ? model.usageScope : "disabled",
        }),
      });
    } catch {
      // Backend endpoint may not exist yet. UI state still updates.
    }

    setModels((current) =>
      current.map((item) =>
        item.id === model.id
          ? {
              ...item,
              enabled: nextEnabled,
              usageScope: nextEnabled ? item.usageScope === "disabled" ? "both" : item.usageScope : "disabled",
              isDefault: nextEnabled ? item.isDefault : false,
              status: nextStatus,
              updatedAt: nowIso(),
            }
          : item
      )
    );
  }

  async function deleteModel(model: RegistryModel) {
    try {
      await backendRequest(`/models/${encodeURIComponent(model.id)}`, {
        method: "DELETE",
      });
    } catch {
      // Backend endpoint may not exist yet. UI state still updates.
    }

    setModels((current) => current.filter((item) => item.id !== model.id));
    setOpenMenuId(null);
  }

  useEffect(() => {
    void loadModels();
  }, []);

  useEffect(() => {
    saveLocalModels(models);
  }, [models]);

  return (
    <main className="hxg-background min-h-screen px-4 py-6 text-white sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1500px] space-y-7">
        <section className="relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#1f2122]/95 px-8 py-9 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_18%,rgba(255,52,52,0.10),transparent_38%),radial-gradient(circle_at_58%_14%,rgba(74,215,255,0.08),transparent_36%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] [background-size:44px_44px]" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.32em] text-[#4ad7ff]">
                Model Operations
              </p>
              <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.05em] text-white md:text-6xl">
                Model Registry
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#a9a9a9] md:text-base">
                Manage target models, provider connections, and testing readiness.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openAddModal()}
                className="rounded-full bg-[#ff3434] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ff4545]"
              >
                + Add Model
              </button>

              <button
                type="button"
                onClick={loadModels}
                disabled={loading}
                className="rounded-full border border-[#4ad7ff]/35 px-5 py-3 text-sm font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Refresh Models"}
              </button>

              <button
                type="button"
                onClick={() => void testAllConnections()}
                disabled={loading || Boolean(testingModelId) || Boolean(testAllProgress)}
                className="h-11 rounded-full border border-white/[0.10] px-4 text-xs font-black text-white transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {testAllProgress
                  ? `Testing ${testAllProgress.current}/${testAllProgress.total}`
                  : "Test All Connections"}
              </button>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <section className="rounded-[18px] border border-amber-400/25 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
            {errorMessage}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Configured Models" value={summary.total} helper="All registered targets" />
          <SummaryCard label="Ready for Testing" value={summary.ready} helper="Enabled and selectable" tone="success" />
          <SummaryCard label="Needs Attention" value={summary.attention} helper="Untested, broken, or disabled" tone="warning" />
          <SummaryCard label="Default Target" value={summary.defaultModel} helper="Preselected in workflows" tone="info" />
        </section>

        <section className="rounded-[23px] border border-white/[0.04] bg-[#27292a]/95 p-6">
          <div className="mb-5">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
              Provider Status
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">Provider Configuration</h2>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {providerCards.map((provider) => (
              <ProviderCard
                key={provider.value}
                provider={provider}
                count={providerCounts[provider.value]?.total || 0}
                readyCount={providerCounts[provider.value]?.ready || 0}
                onConfigure={() => openAddModal(provider.value)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-[23px] border border-white/[0.04] bg-[#27292a]/95 p-6">
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
                Target Models
              </p>
              <h2 className="mt-1 text-2xl font-black text-white">Model Registry Table</h2>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search models..."
                className="h-11 rounded-[14px] border border-white/[0.06] bg-[#1f2122] px-4 text-sm text-white outline-none placeholder:text-[#727272] focus:border-[#4ad7ff]/70"
              />

              <select
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value)}
                className="h-11 rounded-[14px] border border-white/[0.06] bg-[#1f2122] px-4 text-sm text-white outline-none focus:border-[#4ad7ff]/70"
              >
                <option value="all">All providers</option>
                {PROVIDERS.map((provider) => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-11 rounded-[14px] border border-white/[0.06] bg-[#1f2122] px-4 text-sm text-white outline-none focus:border-[#4ad7ff]/70"
              >
                <option value="all">All statuses</option>
                {["ready", "untested", "needs_setup", "connection_error", "unavailable", "disabled", "demo_only", "testing"].map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status as ModelStatus)}
                  </option>
                ))}
              </select>

              <select
                value={usageFilter}
                onChange={(event) => setUsageFilter(event.target.value)}
                className="h-11 rounded-[14px] border border-white/[0.06] bg-[#1f2122] px-4 text-sm text-white outline-none focus:border-[#4ad7ff]/70"
              >
                <option value="all">All usage</option>
                <option value="both">Manual + Campaigns</option>
                <option value="manual">Manual only</option>
                <option value="campaigns">Campaigns only</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>

          {filteredModels.length === 0 ? (
            <div className="rounded-[20px] border border-white/[0.06] bg-[#1f2122] p-10 text-center">
              <h3 className="text-2xl font-black text-white">No models configured yet.</h3>
              <p className="mt-2 text-sm text-[#a9a9a9]">
                Add your first target model to start testing.
              </p>
              <button
                type="button"
                onClick={() => openAddModal()}
                className="mt-5 rounded-full bg-[#ff3434] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ff4545]"
              >
                + Add Model
              </button>
            </div>
          ) : (
            <div className="overflow-visible rounded-[18px] border border-white/[0.06]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                  <thead className="bg-[#1f2122] text-[10px] uppercase tracking-[0.18em] text-[#727272]">
                    <tr>
                      <th className="px-4 py-3">Model</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Usage</th>
                      <th className="px-4 py-3">Default</th>
                      <th className="px-4 py-3">Last Tested</th>
                      <th className="w-[220px] px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredModels.map((model) => (
                      <tr key={model.id} className="border-t border-white/[0.06] bg-[#27292a]/60 transition hover:bg-white/[0.035]">
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => setDetailsModel(model)} className="max-w-[360px] text-left">
                            <p className="truncate font-black text-white hover:text-[#4ad7ff]">
                              {model.displayName}
                            </p>
                            <p title={model.modelId} className="mt-1 truncate font-mono text-xs text-[#4ad7ff]">
                              {model.modelId}
                            </p>
                          </button>
                        </td>

                        <td className="px-4 py-3 text-[#d4d4d4]">{providerLabel(model.provider)}</td>

                        <td className="px-4 py-3"><Badge status={model.status} /></td>

                        <td className="px-4 py-3 font-mono text-xs text-[#d4d4d4]">
                          {usageLabel(model.usageScope)}
                        </td>

                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${
                            model.isDefault
                              ? "border-[#4ad7ff]/25 bg-[#4ad7ff]/10 text-[#4ad7ff]"
                              : "border-white/[0.08] bg-white/[0.04] text-[#727272]"
                          }`}>
                            {model.isDefault ? "Yes" : "No"}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono text-xs text-[#a9a9a9]">
                          {formatDate(model.lastTestedAt)}
                        </td>

                        <td className="relative px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailsModel(model)}
                              className="h-9 rounded-[12px] border border-white/[0.08] bg-[#1f2122] px-4 text-xs font-black text-white transition hover:border-[#4ad7ff]/30"
                            >
                              View
                            </button>

                            <button
                              type="button"
                              onClick={() => testConnection(model)}
                              disabled={testingModelId === model.id}
                              className="h-9 rounded-[12px] border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-4 text-xs font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {testingModelId === model.id ? "Testing..." : "Test"}
                            </button>

                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenMenuId(openMenuId === model.id ? null : model.id)}
                                className="h-9 rounded-[12px] border border-white/[0.08] bg-[#1f2122] px-4 text-xs font-black text-white transition hover:border-[#4ad7ff]/30"
                              >
                                ...
                              </button>

                              {openMenuId === model.id ? (
                                <div className="absolute right-0 top-11 z-30 w-48 overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#1f2122] p-1 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openEditModal(model);
                                      setOpenMenuId(null);
                                    }}
                                    className="block w-full rounded-[10px] px-4 py-3 text-left text-xs font-black text-white transition hover:bg-white/[0.05]"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      void setDefaultModel(model);
                                      setOpenMenuId(null);
                                    }}
                                    className="block w-full rounded-[10px] px-4 py-3 text-left text-xs font-black text-white transition hover:bg-white/[0.05]"
                                  >
                                    Set Default
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      void toggleModel(model);
                                      setOpenMenuId(null);
                                    }}
                                    className="block w-full rounded-[10px] px-4 py-3 text-left text-xs font-black text-white transition hover:bg-white/[0.05]"
                                  >
                                    {model.enabled ? "Disable" : "Enable"}
                                  </button>

                                  <button
                                  type="button"
                                  onClick={() => void deleteModel(model)}
                                  className="mt-1 block w-full rounded-[10px] border-t border-white/[0.06] px-4 py-3 text-left text-xs font-black text-red-300 transition hover:bg-red-500/10"
                                >
                                  Delete
                                </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[23px] border border-white/[0.04] bg-[#27292a]/95 p-6">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
            Recent Connection Checks
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">Activity Log</h2>

          <div className="mt-5 overflow-hidden rounded-[18px] border border-white/[0.06]">
            {connectionChecks.length === 0 ? (
              <div className="bg-[#1f2122] p-5 text-sm text-[#a9a9a9]">
                No connection checks yet. Click Test from any model row.
              </div>
            ) : (
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead className="bg-[#1f2122] text-[10px] uppercase tracking-[0.18em] text-[#727272]">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Latency</th>
                    <th className="px-4 py-3">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {connectionChecks.map((check) => (
                    <tr key={check.id} className="border-t border-white/[0.06] bg-[#27292a]/60">
                      <td className="px-4 py-3 font-mono text-xs text-[#a9a9a9]">{formatTime(check.checkedAt)}</td>
                      <td className="px-4 py-3 font-black text-white">{check.displayName}</td>
                      <td className="px-4 py-3 text-[#d4d4d4]">{providerLabel(check.provider)}</td>
                      <td className="px-4 py-3"><Badge status={check.status} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-[#d4d4d4]">{check.latencyMs} ms</td>
                      <td className="px-4 py-3 text-[#a9a9a9]">{check.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {modalMode ? (
        <ModelFormModal
          mode={modalMode}
          form={form}
          setForm={setForm}
          onClose={() => {
            setModalMode(null);
            setForm(DEFAULT_FORM);
            setFormErrors({});
            setModalTestResult(null);
          }}
          onSave={() => void saveModelState()}
          onSaveAndTest={() => void saveModelState({ testAfterSave: true })}
          saving={saving}
          testing={Boolean(testingModelId)}
          validationErrors={formErrors}
          testResult={modalTestResult}
        />
      ) : null}

      {detailsModel ? (
        <DetailsModal
          model={detailsModel}
          onClose={() => setDetailsModel(null)}
          onTest={() => void testConnection(detailsModel)}
          onEdit={() => {
            openEditModal(detailsModel);
            setDetailsModel(null);
          }}
          onDefault={() => void setDefaultModel(detailsModel)}
          onToggle={() => void toggleModel(detailsModel)}
        />
      ) : null}

      {connectionResult ? (
        <ConnectionModal
          result={connectionResult}
          onClose={() => setConnectionResult(null)}
          onTestAgain={() => {
            const model = models.find((item) => item.modelId === connectionResult.modelId);

            setConnectionResult(null);

            if (model) {
              void testConnection(model);
            }
          }}
          onEditConfiguration={() => {
            const model = models.find((item) => item.modelId === connectionResult.modelId);

            setConnectionResult(null);

            if (model) {
              openEditModal(model);
            }
          }}
        />
      ) : null}
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CampaignModelOption,
  ModelProviderStatus,
  createRegistryModel,
  deleteRegistryModel,
  getModelProviders,
  listRegistryModels,
  setDefaultRegistryModel,
  testModelProvider,
  testRegistryModel,
  updateRegistryModel,
} from "@/lib/modelProviderApi";

type ProviderName =
  | "mock"
  | "openai"
  | "groq"
  | "gemini"
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


const MODEL_STORAGE_KEY = "hexaguard_model_registry";
const READY_MODELS_STORAGE_KEY = "hexaguard_ready_models";
const DEFAULT_MODEL_STORAGE_KEY = "hexaguard_default_model";

const PROVIDERS = [
  { value: "mock", label: "Mock", helper: "Demo provider." },
  { value: "openai", label: "OpenAI", helper: "Hosted provider." },
  { value: "groq", label: "Groq", helper: "Hosted provider." },
  { value: "gemini", label: "Gemini", helper: "Hosted provider." },
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
  if (value.includes("gemini") || value.includes("google")) return "gemini";
  if (value.includes("ollama")) return "ollama";
  if (value.includes("lmstudio") || value.includes("lm studio") || value.includes("lm_studio") || value.includes("lm-studio")) return "lmstudio";
  if (value.includes("anthropic") || value.includes("claude")) return "anthropic";
  if (value.includes("huggingface") || value.includes("hugging face") || value.includes("hf")) return "huggingface";
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

function getLastTestedParts(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return {
    datePart,
    timePart,
    label: `${datePart} · ${timePart}`,
  };
}

function formatLastTested(value?: string | null) {
  const parts = getLastTestedParts(value);
  return parts ? parts.label : "Not tested";
}

function formatDate(value?: string) {
  if (!value) return "Not tested";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${datePart} · ${timePart}`;
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

function workflowReadiness(model: RegistryModel) {
  const runnable = isReadyForTesting(model);
  const disabled =
    !model.enabled || model.usageScope === "disabled" || model.status === "disabled";

  const manualAllowed = model.usageScope === "manual" || model.usageScope === "both";
  const campaignAllowed = model.usageScope === "campaigns" || model.usageScope === "both";

  const blockedReason =
    model.status === "untested"
      ? "Hidden until test"
      : model.status === "needs_setup"
        ? "Needs setup"
        : model.status === "connection_error"
          ? "Connection error"
          : "Not runnable";

  if (disabled) {
    return {
      overall: "Disabled",
      manual: "Manual disabled",
      campaigns: "Campaigns disabled",
      sandboxCompare: "Sandbox / Compare disabled",
      tone: "muted" as const,
    };
  }

  return {
    overall: runnable ? "Runnable" : blockedReason,
    manual: runnable && manualAllowed ? "Manual Ready" : manualAllowed ? `Manual ${blockedReason}` : "Manual disabled",
    campaigns:
      runnable && campaignAllowed ? "Campaign Ready" : campaignAllowed ? `Campaigns ${blockedReason}` : "Campaigns disabled",
    sandboxCompare: runnable ? "Sandbox / Compare Ready" : `Sandbox / Compare ${blockedReason}`,
    tone: runnable ? ("success" as const) : ("warning" as const),
  };
}

function WorkflowReadinessChips({ model }: { model: RegistryModel }) {
  const readiness = workflowReadiness(model);

  const className =
    readiness.tone === "success"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
      : readiness.tone === "muted"
        ? "border-white/[0.08] bg-white/[0.04] text-[#a9a9a9]"
        : "border-amber-400/25 bg-amber-500/10 text-amber-300";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {[readiness.overall, readiness.manual, readiness.campaigns, readiness.sandboxCompare].map((label) => (
        <span
          key={label}
          className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${className}`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function defaultBaseUrl(provider: ProviderName) {
  if (provider === "ollama") return "http://localhost:11434";
  if (provider === "lmstudio") return "http://localhost:1234/v1";
  return "";
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

function isBuiltInDemoModel(model: RegistryModel) {
  const provider = String(model.provider || "").toLowerCase();
  const modelKey = String(model.id || model.modelId || "").toLowerCase();

  return (
    model.status === "demo_only" ||
    provider === "mock" ||
    modelKey.includes("mock-safe") ||
    modelKey.includes("mock:")
  );
}

function modelMissingRequiredSetup(model: RegistryModel) {
  const provider = String(model.provider || "").toLowerCase();

  if (isBuiltInDemoModel(model)) return false;

  return (
    model.status === "needs_setup" ||
    model.status === "connection_error" ||
    (provider !== "ollama" && model.apiKeyConfigured === false)
  );
}

function primaryModelAction(model: RegistryModel): "configure" | "enable" | "test" {
  if (modelMissingRequiredSetup(model)) return "configure";

  if (model.status === "disabled" || model.enabled === false) {
    return "enable";
  }

  return "test";
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
            : "border-red-400/30 bg-[#1f2122] text-red-300";

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
          ? "border-red-400/30 bg-[#1f2122] text-red-300"
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
  const hasModels = count > 0;
  const hasReadyModels = readyCount > 0;

  const providerState = hasReadyModels
    ? "Ready"
    : hasModels
      ? "Registered"
      : "Needs Setup";

  const providerStateClass = hasReadyModels
    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
    : hasModels
      ? "border-cyan-400/25 bg-cyan-500/10 text-cyan-300"
      : "border-amber-400/25 bg-amber-500/10 text-amber-300";

  return (
    <article className="rounded-[18px] border border-white/[0.06] bg-[#27292a] p-4 shadow-[0_16px_35px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-white">{provider.label}</h3>
          <p className="mt-1 text-xs text-[#8a8a8a]">{provider.helper || "Provider setup"}</p>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-black ${providerStateClass}`}
        >
          {providerState}
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
  const requiresApiKey =
  provider === "openai" || provider === "groq" || provider === "gemini";
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
                  : "border-red-400/30 bg-[#1f2122]"
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
            className="rounded-full px-6 py-3 text-sm font-black text-white transition hover:bg-[#ff4545] disabled:cursor-not-allowed disabled:opacity-50"
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
  const identityRows = [
    ["Provider", providerLabel(model.provider)],
    ["Model ID", model.modelId],
    ["Base URL", model.baseUrl || "Not required"],
  ];

  const workflow = workflowReadiness(model);

  const readinessRows = [
    ["Registry Status", model.enabled ? "Enabled" : "Disabled"],
    ["Workflow Readiness", workflow.overall],
    ["Manual Red Teaming", workflow.manual],
    ["Campaigns", workflow.campaigns],
    ["Sandbox / Compare", workflow.sandboxCompare],
    ["API Key", model.apiKeyConfigured ? "Configured" : "Not configured"],
    ["Last Tested", formatLastTested(model.lastTestedAt)],
    ["Latency", model.latencyMs ? `${model.latencyMs} ms` : "Not available"],
    ["Last Error", model.lastError || "None"],
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-4 pt-24 pb-6 backdrop-blur-xl">
      <section className="flex max-h-[calc(100vh-120px)] w-full max-w-xl flex-col overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#202323] shadow-[0_30px_100px_rgba(0,0,0,0.62)]">
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] bg-[#27292a] px-5 py-4">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
              Model Details
            </p>
            <h2 className="mt-2 text-xl font-black text-white">{model.displayName}</h2>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge status={model.status} />
              <span className="rounded-full border border-white/[0.08] bg-[#1f2122] px-3 py-1 text-[11px] font-black text-[#d4d4d4]">
                {usageLabel(model.usageScope)}
              </span>
              {model.isDefault ? (
                <span className="rounded-full border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-3 py-1 text-[11px] font-black text-[#4ad7ff]">
                  Default
                </span>
              ) : null}
            </div>

            <WorkflowReadinessChips model={model} />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] border border-white/[0.08] bg-[#1f2122] text-lg font-black text-white transition hover:border-red-400/40 hover:text-red-300"
            aria-label="Close model details"
          >
            ×
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-[#4ad7ff]">
              Identity
            </p>
            <div className="mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-[16px] border border-white/[0.06] bg-[#1f2122]">
              {identityRows.map(([label, value]) => (
                <div key={label} className="grid gap-2 px-4 py-3 sm:grid-cols-[150px_1fr]">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">{label}</p>
                  <p title={value} className="truncate text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-[#4ad7ff]">
              Readiness
            </p>
            <div className="mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-[16px] border border-white/[0.06] bg-[#1f2122]">
              {readinessRows.map(([label, value]) => (
                <div data-models-summary key={label} className="grid gap-2 px-4 py-3 sm:grid-cols-[150px_1fr] mx-auto w-full max-w-[1280px] [&>*]:flex [&>*]:flex-col [&>*]:items-center [&>*]:justify-center [&>*]:text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">{label}</p>
                  <p title={value} className="truncate text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-white/[0.08] bg-[#27292a] px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-full border border-white/[0.08] px-4 py-2.5 text-sm font-black text-[#d4d4d4] transition hover:bg-white/[0.04]">
            Close
          </button>
          <button type="button" onClick={onEdit} className="rounded-full border border-white/[0.08] px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/[0.04]">
            Edit
          </button>
          <button type="button" onClick={onTest} className="rounded-full border border-[#4ad7ff]/35 px-4 py-2.5 text-sm font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10">
            Test Connection
          </button>
          <button type="button" onClick={onDefault} disabled={!isReadyForTesting(model)} className="rounded-full border border-emerald-400/25 px-4 py-2.5 text-sm font-black text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40">
            Set Default
          </button>
          <button type="button" onClick={onToggle} className="rounded-full px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#ff4545]">
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
      <section data-models-activity-section className="mx-auto w-full overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#202323] shadow-[0_30px_100px_rgba(0,0,0,0.62)] max-w-[1280px]">
        <header className="border-b border-white/[0.08] bg-[#27292a] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
                Connection Test Result
              </p>
              <div className="mx-auto max-w-[1280px] mt-3 flex flex-wrap items-center gap-3">
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

            <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-white/[0.08] bg-[#1f2122] text-lg font-black text-white transition hover:border-red-400/40 hover:text-red-300" aria-label="Close connection result">
              ×
            </button>
          </div>
        </header>

        <div className="px-6 py-5">
          <div className="mx-auto w-full max-w-[1280px] grid gap-3 sm:grid-cols-2 [&>*]:flex [&>*]:flex-col [&>*]:items-center [&>*]:justify-center [&>*]:text-center">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-[15px] border border-white/[0.06] bg-[#1f2122] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">{label}</p>
                <p title={value} className="mt-2 truncate text-sm font-bold text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className={`mt-4 rounded-[16px] border bg-[#1f2122] p-4 ${
            isSuccess ? "border-emerald-400/20" : "border-red-400/30"
          }`}>
            <p className={`text-sm font-black ${isSuccess ? "text-emerald-300" : "text-red-300"}`}>
              {isSuccess ? "No action required." : "Suggested Fix"}
            </p>
            <p className="mt-1 text-sm leading-6 text-[#d4d4d4]">
              {isSuccess
                ? result.suggestedFix || "This model can be used in enabled workflows."
                : result.suggestedFix}
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-white/[0.08] bg-[#27292a] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full border border-white/[0.08] px-5 py-3 text-sm font-black text-[#d4d4d4] transition hover:bg-white/[0.04]">
            Close
          </button>

          {!isAggregate && onTestAgain ? (
            <button type="button" onClick={onTestAgain} className="rounded-full border border-[#4ad7ff]/35 px-5 py-3 text-sm font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10">
              Test Again
            </button>
          ) : null}

          {!isSuccess && !isAggregate && onEditConfiguration ? (
            <button type="button" onClick={onEditConfiguration} className="rounded-full px-6 py-3 text-sm font-black text-white transition hover:bg-[#ff4545]">
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
  const [actionMenuPosition, setActionMenuPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!openMenuId) return;

    function handleModelsActionMenuPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      if (target?.closest("[data-model-action-menu]")) {
        return;
      }

      setOpenMenuId(null);
      setActionMenuPosition(null);
    }

    function handleModelsActionMenuKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      setOpenMenuId(null);
      setActionMenuPosition(null);
    }

    document.addEventListener("mousedown", handleModelsActionMenuPointerDown);
    document.addEventListener("keydown", handleModelsActionMenuKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleModelsActionMenuPointerDown);
      document.removeEventListener("keydown", handleModelsActionMenuKeyDown);
    };
  }, [openMenuId]);


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
      const registry = await listRegistryModels();

      const registryModels = registry.items.map((item: any, index: number) =>
        normalizeBackendModel(item, index)
      );

      const providerPayload = await getModelProviders();
      const providerModels = providerPayload.campaign_models.map(mapCampaignModel);

      const nextModels =
        registryModels.length > 0
          ? mergeById(registryModels)
          : mergeById([...providerModels, ...loadLocalModels()]);

      setProviders(providerPayload.providers);
      setModels(nextModels);
      saveLocalModels(nextModels);
    } catch (error) {
      try {
        const providerPayload = await getModelProviders();
        const providerModels = providerPayload.campaign_models.map(mapCampaignModel);
        const localModels = loadLocalModels();
        const nextModels = mergeById([...providerModels, ...localModels]);

        setProviders(providerPayload.providers);
        setModels(nextModels);
        saveLocalModels(nextModels);

        setErrorMessage(
          "Models Registry backend was unavailable, so HexaGuard loaded provider/local fallback models."
        );
      } catch {
        const localModels = loadLocalModels();

        setModels(localModels);
        saveLocalModels(localModels);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load model registry."
        );
      }
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

    if ( (provider === "openai" || provider === "groq" || provider === "gemini") &&
      !form.apiKey.trim() &&
      !form.maskedKey) { 
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
    setErrorMessage("");

    try {
      const payload = {
        displayName: form.displayName.trim(),
        display_name: form.displayName.trim(),
        provider: form.provider,
        modelId: form.modelId.trim(),
        model_id: form.modelId.trim(),
        baseUrl: form.baseUrl.trim() || undefined,
        base_url: form.baseUrl.trim() || undefined,
        apiKey: form.apiKey.trim() || undefined,
        api_key: form.apiKey.trim() || undefined,
        usageScope: form.usageScope,
        usage_scope: form.usageScope,
        enabled: form.enabled,
        isDefault: form.isDefault,
        is_default: form.isDefault,
        capabilityType: "chat",
        capability_type: "chat",
      };

      const apiModel = form.id
        ? await updateRegistryModel(form.id, payload)
        : await createRegistryModel(payload);

      const savedModel = normalizeBackendModel(apiModel, 0);

      setModels((current) => {
        const nextModels = form.id
          ? current.map((model) => (model.id === form.id ? savedModel : model))
          : [savedModel, ...current];

        const mergedModels = mergeById(nextModels);
        saveLocalModels(mergedModels);
        return mergedModels;
      });

      setModalMode(null);
      setForm(DEFAULT_FORM);
      setFormErrors({});

      if (options?.testAfterSave) {
        await testConnection(savedModel, { inline: true });
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to save model."
      );
    } finally {
      setSaving(false);
    }
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
      const apiResult = await testRegistryModel(model.id);

      const result: ConnectionCheck = {
        id: apiResult.id,
        modelId: apiResult.modelId,
        displayName: apiResult.displayName,
        provider: normalizeProvider(apiResult.provider),
        status: mapBackendStatus(apiResult.status, true, apiResult.checkedAt),
        success: apiResult.success,
        message: apiResult.message,
        suggestedFix: apiResult.suggestedFix,
        latencyMs: apiResult.latencyMs,
        checkedAt: apiResult.checkedAt,
      };

      setConnectionChecks((current) => [result, ...current].slice(0, 8));

      if (!options?.silent) {
        setConnectionResult(result);
      }

      setModels((current) => {
        const nextModels = current.map((item) =>
          item.id === model.id
            ? {
                ...item,
                status: result.status,
                lastTestedAt: result.checkedAt,
                latencyMs: result.latencyMs,
                lastError: result.success ? "" : result.message,
              }
            : item
        );

        saveLocalModels(nextModels);
        return nextModels;
      });

      return result;
    } catch (error) {
      let fallbackMessage =
        error instanceof Error ? error.message : "Connection test failed.";

      try {
        const fallback = await testModelProvider({
          provider: model.provider,
          base_url: model.baseUrl,
          model_name: model.modelId,
        });

        fallbackMessage = fallback.message;
      } catch {
        // Keep safe original message.
      }

      const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
      const failedResult: ConnectionCheck = {
        id: `connection-${model.id}-${Date.now()}`,
        modelId: model.modelId,
        displayName: model.displayName,
        provider: model.provider,
        status: "connection_error" as ModelStatus,
        success: false,
        message: fallbackMessage,
        suggestedFix: "Check the API key, base URL, model ID, provider availability, then test the connection again.",
        latencyMs,
        checkedAt: nowIso(),
      };

      setConnectionChecks((current) => [failedResult, ...current].slice(0, 8));

      if (!options?.silent) {
        setConnectionResult(failedResult);
      }

      setModels((current) => {
        const nextModels = current.map((item) =>
          item.id === model.id
            ? {
                ...item,
                status: "connection_error" as ModelStatus,
                lastTestedAt: failedResult.checkedAt,
                latencyMs,
                lastError: fallbackMessage,
              }
            : item
        );

        saveLocalModels(nextModels);
        return nextModels;
      });

      return failedResult;
    } finally {
      setTestingModelId(null);
      setModalTestResult(null);
    }
  }


  async function testAllConnections() {
    const candidates = models.filter((model) => {
      if (!model.enabled || model.usageScope === "disabled" || model.status === "disabled") {
        return false;
      }

      const provider = normalizeProvider(model.provider);

      if (provider === "mock") return true;

      if (provider === "openai" || provider === "groq" || provider === "gemini") {
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
        message: "Only Ready or Demo Only models can be set as default.",
        suggestedFix: "Test and fix the model connection before making it the default target.",
        latencyMs: 0,
        checkedAt: nowIso(),
      });

      return;
    }

    try {
      const apiModel = await setDefaultRegistryModel(model.id);
      const updatedModel = normalizeBackendModel(apiModel, 0);

      setModels((current) => {
        const nextModels = current.map((item) => ({
          ...item,
          isDefault: item.id === model.id,
          status: item.id === model.id ? updatedModel.status : item.status,
          updatedAt: item.id === model.id ? nowIso() : item.updatedAt,
        }));

        saveLocalModels(nextModels);
        return nextModels;
      });
    } catch (error) {
      setConnectionResult({
        id: `default-error-${Date.now()}`,
        modelId: model.modelId,
        displayName: model.displayName,
        provider: model.provider,
        status: model.status,
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to set default model.",
        suggestedFix: "Confirm the model is Ready or Demo Only, then try again.",
        latencyMs: 0,
        checkedAt: nowIso(),
      });
    }
  }


  async function toggleModel(model: RegistryModel) {
    const nextEnabled = !model.enabled;

    try {
      const apiModel = await updateRegistryModel(model.id, {
        enabled: nextEnabled,
        usageScope: model.usageScope,
        usage_scope: model.usageScope,
      });

      const updatedModel = normalizeBackendModel(apiModel, 0);

      setModels((current) => {
        const nextModels = current.map((item) =>
          item.id === model.id ? updatedModel : item
        );

        saveLocalModels(nextModels);
        return nextModels;
      });
    } catch {
      const nextStatus: ModelStatus = nextEnabled
        ? model.status === "disabled"
          ? "untested"
          : model.status
        : "disabled";

      setModels((current) => {
        const nextModels = current.map((item) =>
          item.id === model.id
            ? {
                ...item,
                enabled: nextEnabled,
                status: nextStatus,
                isDefault: nextEnabled ? item.isDefault : false,
                updatedAt: nowIso(),
              }
            : item
        );

        saveLocalModels(nextModels);
        return nextModels;
      });
    }
  }


  async function deleteModel(model: RegistryModel) {
    try {
      await deleteRegistryModel(model.id);
    } catch {
      // Keep UI responsive even if backend delete fails or backend is unavailable.
    }

    setModels((current) => {
      const nextModels = current.filter((item) => item.id !== model.id);
      saveLocalModels(nextModels);
      return nextModels;
    });
  }


  useEffect(() => {
    if (!openMenuId) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
        setActionMenuPosition(null);
      }
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      if (
        target?.closest("[data-model-action-menu]") ||
        target?.closest("[data-model-action-trigger]")
      ) {
        return;
      }

      setOpenMenuId(null);
      setActionMenuPosition(null);
    }

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [openMenuId]);

  useEffect(() => {
    void loadModels();
  }, []);

  useEffect(() => {
    saveLocalModels(models);
  }, [models]);

  return (
    <main className="hxg-background min-h-screen px-4 py-6 text-white sm:px-6 xl:px-8">

      <style>{`
        [data-model-row-action-menu] button:last-of-type,
        [data-model-action-menu] button:last-of-type {
          background: transparent !important;
          color: #fca5a5 !important;
          font-size: 0 !important;
          box-shadow: none !important;
        }

        [data-model-row-action-menu] button:last-of-type::before,
        [data-model-action-menu] button:last-of-type::before {
          content: "Delete Model";
          font-size: 12px !important;
          font-weight: 900 !important;
        }

        [data-model-row-action-menu] button:last-of-type:hover,
        [data-model-action-menu] button:last-of-type:hover {
          background: rgba(239, 68, 68, 0.10) !important;
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1500px] space-y-7">
        <section
          data-models-hero="manual-style-v3"
          className="relative mx-auto min-h-[452px] max-w-[1280px] overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#1f2122]/80 px-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:px-12"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 8% 18%, rgba(255,52,52,0.12), transparent 38%), radial-gradient(circle at 88% 18%, rgba(74,215,255,0.10), transparent 38%), linear-gradient(135deg, rgba(18,20,21,0.98), rgba(31,33,34,0.94) 52%, rgba(39,41,42,0.90))",
            }}
          />

          <div
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
              backgroundSize: "52px 52px",
              backgroundPosition: "center center",
            }}
          />

          <div className="relative z-10 flex min-h-[452px] flex-col items-center justify-center">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.35em] text-[#4ad7ff]">
              MODEL OPERATIONS
            </p>

            <h1 className="mt-5 whitespace-nowrap text-3xl font-black uppercase leading-[0.95] tracking-[-0.04em] text-white md:text-4xl xl:text-5xl">
              AI MODEL <span className="text-[#ff3434]">REGISTRY</span>
            </h1>

            <p className="mx-auto mt-7 max-w-4xl text-lg leading-8 text-[#d4d4d4]">
              Manage target models, provider connections, readiness status, default targets, and workflow availability.
            </p>

            
          </div>
        </section>

        <section data-models-summary-compact className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <article className="flex min-h-[122px] flex-col items-center justify-center rounded-[18px] border border-white/[0.08] bg-[#27292a]/88 px-5 py-4 text-center shadow-[0_18px_55px_rgba(0,0,0,0.24)]">
            <p className="text-center font-mono text-[11px] font-black uppercase tracking-[0.20em] text-[#d4d4d4]">
              Configured Models
            </p>
            <p className="mt-2 text-center text-3xl font-black text-white">
              {summary.total}
            </p>
            <p className="mt-2 text-center text-sm text-[#d4d4d4]">
              All registered targets
            </p>
          </article>

          <article className="flex min-h-[122px] flex-col items-center justify-center rounded-[18px] border border-emerald-300/[0.12] bg-emerald-500/[0.10] px-5 py-4 text-center shadow-[0_18px_55px_rgba(0,0,0,0.24)]">
            <p className="text-center font-mono text-[11px] font-black uppercase tracking-[0.20em] text-emerald-300">
              Ready for Testing
            </p>
            <p className="mt-2 text-center text-3xl font-black text-emerald-300">
              {summary.ready}
            </p>
            <p className="mt-2 text-center text-sm text-emerald-200/80">
              Enabled and selectable
            </p>
          </article>

          <article className="flex min-h-[122px] flex-col items-center justify-center rounded-[18px] border border-[#ffcc33]/[0.14] bg-[#ffb347]/[0.12] px-5 py-4 text-center shadow-[0_18px_55px_rgba(0,0,0,0.24)]">
            <p className="text-center font-mono text-[11px] font-black uppercase tracking-[0.20em] text-[#ffcc33]">
              Needs Attention
            </p>
            <p className="mt-2 text-center text-3xl font-black text-[#ffcc33]">
              {summary.attention}
            </p>
            <p className="mt-2 text-center text-sm text-[#ffcc33]/80">
              Untested, broken, or disabled
            </p>
          </article>

          <article className="flex min-h-[122px] flex-col items-center justify-center rounded-[18px] border border-[#4ad7ff]/[0.16] bg-[#4ad7ff]/[0.14] px-5 py-4 text-center shadow-[0_18px_55px_rgba(0,0,0,0.24)]">
            <p className="text-center font-mono text-[11px] font-black uppercase tracking-[0.20em] text-[#4ad7ff]">
              Default Target
            </p>
            <p className="mt-2 text-center text-2xl font-black leading-tight text-[#4ad7ff]">
              {summary.defaultModel || "No Default Model"}
            </p>
            <p className="mt-2 text-center text-sm text-[#4ad7ff]/80">
              Preselected in workflows
            </p>
          </article>
        </section>

<section data-models-provider-section className="mx-auto w-full max-w-[1280px] rounded-[23px] border border-white/[0.04] bg-[#27292a]/95 p-6">
          <div className="mx-auto max-w-[1280px] mb-5">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
              Provider Status
            </p>
            
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="mt-1 text-2xl font-black text-white">Provider Configuration</h2>

            <div data-models-provider-actions className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openAddModal()}
                className="inline-flex h-9 min-w-[118px] items-center justify-center rounded-full border border-[#ff3434]/35 bg-[#ff3434] px-4 text-xs font-black text-white shadow-[0_10px_24px_rgba(255,52,52,0.18)] transition hover:bg-[#ff4545]"
              >
                Add Model
              </button>

              <button
                type="button"
                onClick={loadModels}
                className="inline-flex h-9 min-w-[128px] items-center justify-center rounded-full border border-[#ff3434]/35 bg-[#ff3434] px-4 text-xs font-black text-white shadow-[0_10px_24px_rgba(255,52,52,0.18)] transition hover:bg-[#ff4545]"
              >
                Refresh Models
              </button>

              <button
                type="button"
                onClick={testAllConnections}
                disabled={Boolean(testAllProgress)}
                className="inline-flex h-9 min-w-[138px] items-center justify-center rounded-full border border-[#ff3434]/35 bg-[#ff3434] px-4 text-xs font-black text-white shadow-[0_10px_24px_rgba(255,52,52,0.18)] transition hover:bg-[#ff4545] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {testAllProgress
                  ? `Testing ${testAllProgress.current}/${testAllProgress.total}`
                  : "Test Connections"}
              </button>
            </div>

          </div>
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

        <section className="mx-auto w-full max-w-[1280px] rounded-[23px] border border-white/[0.04] bg-[#27292a]/95 p-6">
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
                Target Models
              </p>
              <h2 className="whitespace-nowrap mt-1 text-2xl font-black text-white">Model Registry</h2>
              <p className="mt-2 text-sm text-[#a9a9a9]">Showing {filteredModels.length} target {filteredModels.length === 1 ? "model" : "models"}</p>
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
              <div className="w-full overflow-visible">
                <table className="w-full table-fixed">
                        
                        <colgroup>
                          <col style={{ width: "34%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "12%" }} />
                          <col style={{ width: "17%" }} />
                          <col style={{ width: "17%" }} />
                          <col style={{ width: "8%" }} />
                        </colgroup>
                  <thead className="bg-[#1f2122]">
                    <tr className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#a9a9a9]">
                      <th className="px-4 py-4 text-left">Model</th>
                      <th className="px-4 py-4 text-left">Provider</th>
                      <th className="px-4 py-4 text-left">Status</th>
                      <th className="px-4 py-4 text-left">Usage</th>
                      <th className="px-4 py-4 text-left">Last Tested</th>
                      <th className="px-4 py-4 text-center">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredModels.map((model) => (
                      <tr key={model.id} className="border-t border-white/[0.06] text-sm text-[#d4d4d4]">
                        <td className="px-4 py-5 align-middle">
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="truncate text-base font-black text-white">
                                {model.displayName}
                              </span>

                              {model.isDefault ? (
                                <span className="rounded-full border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#4ad7ff]">
                                  Default
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-1 truncate font-mono text-xs text-[#4ad7ff]">
                              {model.modelId}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-5 align-middle text-sm text-[#d4d4d4]">
                          {providerLabel(model.provider)}
                        </td>

                        <td className="px-4 py-5 align-middle">
                          <Badge status={model.status} />
                        </td>

                        <td className="px-4 py-5 align-middle font-mono text-xs leading-5 text-[#d4d4d4]">
                          {usageLabel(model.usageScope)}
                        </td>

                        <td
                          className="px-4 py-5 align-middle font-mono text-xs leading-5 text-[#d4d4d4]"
                          title={formatLastTested(model.lastTestedAt)}
                        >
                          {(() => {
                            const tested = getLastTestedParts(model.lastTestedAt);

                            if (!tested) {
                              return <span className="block whitespace-nowrap">Not tested</span>;
                            }

                            return (
                              <span className="block">
                                <span className="block whitespace-nowrap">{tested.datePart}</span>
                                <span className="block whitespace-nowrap text-[#a9a9a9]">{tested.timePart}</span>
                              </span>
                            );
                          })()}
                        </td>

                        <td className="px-4 py-5 align-middle">
                          <div className="flex min-w-[48px] items-center justify-center gap-1.5 whitespace-nowrap">
                            {(() => {
                              const action = primaryModelAction(model);

                              if (action === "enable") {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => void toggleModel(model)}
                                    className="flex h-9 items-center justify-center rounded-[10px] border border-emerald-400/25 bg-emerald-500/10 px-3 text-[11px] font-black text-emerald-300 transition hover:bg-emerald-500/15"
                                  >
                                    Enable
                                  </button>
                                );
                              }

                              return null;
                            })()}

                            <button
                              type="button"
                              data-model-action-menu
                              onMouseDown={(event) => {
                                event.stopPropagation();
                              }}
                              onClick={(event) => {
                                event.stopPropagation();

                                if (openMenuId === model.id) {
                                  setOpenMenuId(null);
                                  setActionMenuPosition(null);
                                  return;
                                }

                                const rect = event.currentTarget.getBoundingClientRect();

                                setOpenMenuId(model.id);
                                setActionMenuPosition({
                                  top: rect.bottom + 8,
                                  left: Math.max(16, Math.min(rect.right - 240, window.innerWidth - 256)),
                                });
                              }}
                              className="flex h-9 w-11 items-center justify-center rounded-[10px] border border-white/[0.08] bg-[#1f2122] text-[11px] font-black text-white transition hover:border-[#4ad7ff]/30"
                              aria-label={`More actions for ${model.displayName}`}
                            >
                              ...
                            </button>
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
                Run a model test to see connection history here.
              </div>
            ) : (
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead className="bg-[#1f2122] text-[10px] uppercase tracking-[0.18em] text-[#727272]">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3 min-w-[260px]">Model</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Action</th>
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
                      <td className="px-4 py-3 text-[#a9a9a9]">Test Connection</td>
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


      {openMenuId && actionMenuPosition ? (() => {
        const menuModel = filteredModels.find((model) => model.id === openMenuId);

        if (!menuModel) return null;

        const canSetDefault = isReadyForTesting(menuModel) && !menuModel.isDefault;
        const builtInDemo = isBuiltInDemoModel(menuModel);
        const canDelete = !builtInDemo;
        const isDisabled = menuModel.status === "disabled" || menuModel.enabled === false;
        const needsSetup = modelMissingRequiredSetup(menuModel);
        const mainAction = primaryModelAction(menuModel);

        const menuItemClass =
          "flex h-10 w-full items-center rounded-[10px] px-4 text-left text-[13px] font-black text-[#f4f4f4] transition hover:bg-white/[0.055]";
        const dangerItemClass =
          "flex h-10 w-full items-center rounded-[10px] border border-transparent px-4 text-left text-[13px] font-black text-red-300 transition hover:border-red-400/25 hover:bg-red-500/10";

        return (
          <div
            data-model-action-menu
            className="fixed z-[100] w-[240px] rounded-[18px] border border-white/[0.08] bg-[#1f2122]/98 p-2 shadow-[0_22px_70px_rgba(0,0,0,0.48)]"
            style={{
              top: actionMenuPosition.top,
              left: actionMenuPosition.left,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setDetailsModel(menuModel);
                setOpenMenuId(null);
                setActionMenuPosition(null);
              }}
              className={menuItemClass}
            >
              View Details
            </button>

            <button
              type="button"
              onClick={() => {
                openEditModal(menuModel);
                setOpenMenuId(null);
                setActionMenuPosition(null);
              }}
              className={menuItemClass}
            >
              Configure
            </button>

            {needsSetup ? (
              <button
                type="button"
                onClick={() => {
                  setDetailsModel(menuModel);
                  setOpenMenuId(null);
                  setActionMenuPosition(null);
                }}
                className={menuItemClass}
              >
                Setup Requirements
              </button>
            ) : null}

            {!needsSetup ? (
              <button
                type="button"
                onClick={() => {
                  void testConnection(menuModel);
                  setOpenMenuId(null);
                  setActionMenuPosition(null);
                }}
                className={menuItemClass}
              >
                Test Connection
              </button>
            ) : null}

            {canSetDefault ? (
              <button
                type="button"
                onClick={() => {
                  const confirmed = window.confirm(
                    `Set ${menuModel.displayName} as the default target model?`
                  );

                  if (!confirmed) return;

                  void setDefaultModel(menuModel);
                  setOpenMenuId(null);
                  setActionMenuPosition(null);
                }}
                className={menuItemClass}
              >
                Set as Default
              </button>
            ) : null}

            {mainAction !== "enable" && !needsSetup ? (
              <>
                <div className="my-1 border-t border-white/[0.06]" />

                <button
                  type="button"
                  onClick={() => {
                    if (menuModel.enabled && !window.confirm(`Disable ${menuModel.displayName}?`)) {
                      return;
                    }

                    void toggleModel(menuModel);
                    setOpenMenuId(null);
                    setActionMenuPosition(null);
                  }}
                  className={menuItemClass}
                >
                  {isDisabled ? "Enable Model" : "Disable Model"}
                </button>
              </>
            ) : null}

            {canDelete ? (
              <>
                <div className="my-1 border-t border-white/[0.06]" />

                <button
                  type="button"
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Delete ${menuModel.displayName}? This model will no longer be available for Manual Red Teaming or Campaigns.`
                    );

                    if (!confirmed) return;

                    void deleteModel(menuModel);
                    setOpenMenuId(null);
                    setActionMenuPosition(null);
                  }}
                  className={dangerItemClass}
                >
                  Delete Model
                </button>
              </>
            ) : null}
          </div>
        );
      })() : null}

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

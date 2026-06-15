"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CampaignModelOption,
  ModelProviderListResponse,
  ModelProviderStatus,
  getModelProviders,
  testModelProvider,
} from "@/lib/modelProviderApi";

type ModelStatus = "connected" | "not_configured" | "error" | "disabled" | "demo";
type UsageScope = "manual" | "campaigns" | "both";
type ProviderName = "mock" | "openai" | "groq" | "ollama" | "lmstudio" | "custom" | string;

type RegistryModel = {
  id: string;
  displayName: string;
  provider: ProviderName;
  modelId: string;
  baseUrl: string;
  status: ModelStatus;
  usageScope: UsageScope;
  enabled: boolean;
  isDefault: boolean;
  lastTested: string;
  latencyMs?: number;
  apiKeyMasked?: string;
  description: string;
  configured: boolean;
  availableForManual: boolean;
  availableForCampaigns: boolean;
};

type ModelFormState = {
  id?: string;
  displayName: string;
  provider: ProviderName;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  apiKeyMasked: string;
  usageScope: UsageScope;
  enabled: boolean;
  isDefault: boolean;
  description: string;
};

type ConnectionCheck = {
  id: string;
  provider: string;
  modelId: string;
  status: string;
  message: string;
  latencyMs: number;
  checkedAt: string;
  success: boolean;
};

const PROVIDER_OPTIONS = [
  { value: "mock", label: "Mock Provider" },
  { value: "openai", label: "OpenAI-Compatible" },
  { value: "groq", label: "Groq" },
  { value: "ollama", label: "Ollama" },
  { value: "lmstudio", label: "LM Studio" },
  { value: "custom", label: "Custom Provider" },
];

const DEFAULT_FORM: ModelFormState = {
  displayName: "",
  provider: "mock",
  modelId: "",
  baseUrl: "",
  apiKey: "",
  apiKeyMasked: "",
  usageScope: "both",
  enabled: true,
  isDefault: false,
  description: "",
};

function providerLabel(provider: string) {
  return (
    PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ||
    provider ||
    "Unknown Provider"
  );
}

function normalizeProvider(provider: string): ProviderName {
  const value = provider.toLowerCase();

  if (value.includes("openai")) return "openai";
  if (value.includes("groq")) return "groq";
  if (value.includes("ollama")) return "ollama";
  if (value.includes("lm")) return "lmstudio";
  if (value.includes("mock")) return "mock";

  return provider || "custom";
}

function maskApiKey(value: string) {
  if (!value) return "";

  const compact = value.trim();

  if (compact.length <= 8) {
    return "••••••••";
  }

  return `${compact.slice(0, 3)}••••••••${compact.slice(-4)}`;
}

function formatDate(value?: string) {
  if (!value) return "Not tested";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function statusLabel(status: ModelStatus) {
  switch (status) {
    case "connected":
      return "Connected";
    case "not_configured":
      return "Not Configured";
    case "error":
      return "Error";
    case "disabled":
      return "Disabled";
    case "demo":
      return "Demo Only";
    default:
      return "Unknown";
  }
}

function readinessLabel(model: RegistryModel) {
  if (!model.enabled) return "Disabled";
  if (model.status === "error") return "Connection Error";
  if (model.status === "not_configured") return "Needs API Key";
  if (model.status === "demo") return "Demo Only";
  if (model.status === "connected") return "Ready";

  return "Needs Review";
}

function readinessTone(model: RegistryModel) {
  const label = readinessLabel(model);

  if (label === "Ready") return "success";
  if (label === "Demo Only") return "info";
  if (label === "Needs API Key") return "warning";
  return "danger";
}

function mapCampaignModel(model: CampaignModelOption, index: number): RegistryModel {
  const provider = normalizeProvider(model.provider);
  const isMock = provider === "mock";

  return {
    id: model.value || `${model.provider}-${index}`,
    displayName: model.label || model.value || "Unnamed model",
    provider,
    modelId: model.value || model.label || "",
    baseUrl: provider === "ollama" ? "http://localhost:11434" : "",
    status: !model.available_for_campaigns
      ? model.configured
        ? "error"
        : "not_configured"
      : isMock
        ? "demo"
        : "connected",
    usageScope: "both",
    enabled: model.available_for_campaigns,
    isDefault: index === 0,
    lastTested: "",
    description: model.description || "Target model available for HexaGuard testing workflows.",
    configured: model.configured,
    availableForManual: model.available_for_campaigns,
    availableForCampaigns: model.available_for_campaigns,
    apiKeyMasked: "",
  };
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
  const toneClass =
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
    <article className={`rounded-[20px] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.18)] ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-2 text-xs leading-5 opacity-70">{helper}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: ModelStatus }) {
  const tone =
    status === "connected"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
      : status === "demo"
        ? "border-cyan-400/25 bg-cyan-500/10 text-cyan-300"
        : status === "not_configured"
          ? "border-amber-400/25 bg-amber-500/10 text-amber-300"
          : status === "disabled"
            ? "border-white/[0.08] bg-white/[0.04] text-[#a9a9a9]"
            : "border-red-400/25 bg-red-500/10 text-red-300";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${tone}`}>
      {statusLabel(status)}
    </span>
  );
}

function ReadinessBadge({ model }: { model: RegistryModel }) {
  const tone = readinessTone(model);
  const toneClass =
    tone === "success"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
      : tone === "info"
        ? "border-cyan-400/25 bg-cyan-500/10 text-cyan-300"
        : tone === "warning"
          ? "border-amber-400/25 bg-amber-500/10 text-amber-300"
          : "border-red-400/25 bg-red-500/10 text-red-300";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${toneClass}`}>
      {readinessLabel(model)}
    </span>
  );
}

function ProviderCard({
  provider,
  modelCount,
  onConfigure,
}: {
  provider: ModelProviderStatus;
  modelCount: number;
  onConfigure: () => void;
}) {
  const connected = provider.configured;

  return (
    <article className="rounded-[22px] border border-white/[0.06] bg-[#27292a] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-white">{provider.label}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#a9a9a9]">
            {provider.description || "Provider connection for target models."}
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-black ${
            connected
              ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
              : "border-amber-400/25 bg-amber-500/10 text-amber-300"
          }`}
        >
          {connected ? "Connected" : "Needs Config"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[16px] border border-white/[0.06] bg-[#1f2122] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
            Models
          </p>
          <p className="mt-2 text-2xl font-black text-white">{modelCount}</p>
        </div>

        <div className="rounded-[16px] border border-white/[0.06] bg-[#1f2122] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
            Credential Mode
          </p>
          <p className="mt-2 truncate font-mono text-xs text-[#d4d4d4]">
            {provider.credential_mode || provider.source || "Backend managed"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-[#727272]">
          {provider.security_note || "Credentials should be handled by backend configuration."}
        </p>

        <button
          type="button"
          onClick={onConfigure}
          className="shrink-0 rounded-full border border-[#4ad7ff]/30 px-4 py-2 text-xs font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10"
        >
          Configure
        </button>
      </div>
    </article>
  );
}

function ModelModal({
  mode,
  form,
  setForm,
  onClose,
  onSave,
  onTest,
  testing,
}: {
  mode: "add" | "edit";
  form: ModelFormState;
  setForm: (form: ModelFormState) => void;
  onClose: () => void;
  onSave: () => void;
  onTest: () => void;
  testing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-xl">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[24px] border border-white/[0.08] bg-[#202323] shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
        <div className="border-b border-white/[0.08] bg-[#27292a] px-6 py-5">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
            {mode === "add" ? "Add Target Model" : "Edit Target Model"}
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">
            Model Configuration
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#a9a9a9]">
            Configure target models used by Manual Red Teaming and Campaigns.
            API keys are request-only and must not be permanently stored in the browser.
          </p>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
              Display Name
            </span>
            <input
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              placeholder="Mock Safe Model"
              className="mt-2 h-12 w-full rounded-[16px] border border-white/[0.06] bg-[#1f2122] px-4 text-sm text-white outline-none placeholder:text-[#727272] focus:border-[#4ad7ff]/70"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
              Provider
            </span>
            <select
              value={form.provider}
              onChange={(event) => setForm({ ...form, provider: event.target.value })}
              className="mt-2 h-12 w-full rounded-[16px] border border-white/[0.06] bg-[#1f2122] px-4 text-sm text-white outline-none focus:border-[#4ad7ff]/70"
            >
              {PROVIDER_OPTIONS.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
              Model Identifier
            </span>
            <input
              value={form.modelId}
              onChange={(event) => setForm({ ...form, modelId: event.target.value })}
              placeholder="provider:model-name"
              className="mt-2 h-12 w-full rounded-[16px] border border-white/[0.06] bg-[#1f2122] px-4 font-mono text-sm text-white outline-none placeholder:text-[#727272] focus:border-[#4ad7ff]/70"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
              Base URL
            </span>
            <input
              value={form.baseUrl}
              onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
              placeholder="http://localhost:11434"
              className="mt-2 h-12 w-full rounded-[16px] border border-white/[0.06] bg-[#1f2122] px-4 text-sm text-white outline-none placeholder:text-[#727272] focus:border-[#4ad7ff]/70"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
              API Key
            </span>
            <input
              value={form.apiKey}
              onChange={(event) =>
                setForm({
                  ...form,
                  apiKey: event.target.value,
                  apiKeyMasked: event.target.value ? maskApiKey(event.target.value) : form.apiKeyMasked,
                })
              }
              type="password"
              placeholder={form.apiKeyMasked || "Request-only key"}
              className="mt-2 h-12 w-full rounded-[16px] border border-white/[0.06] bg-[#1f2122] px-4 text-sm text-white outline-none placeholder:text-[#727272] focus:border-[#4ad7ff]/70"
            />
            <p className="mt-2 text-xs text-[#727272]">
              Stored display: {form.apiKeyMasked || "No key stored in frontend"}
            </p>
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
              Usage Scope
            </span>
            <select
              value={form.usageScope}
              onChange={(event) =>
                setForm({ ...form, usageScope: event.target.value as UsageScope })
              }
              className="mt-2 h-12 w-full rounded-[16px] border border-white/[0.06] bg-[#1f2122] px-4 text-sm text-white outline-none focus:border-[#4ad7ff]/70"
            >
              <option value="both">Manual + Campaigns</option>
              <option value="manual">Manual only</option>
              <option value="campaigns">Campaigns only</option>
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
              Description
            </span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Describe where this target model should be used."
              className="mt-2 min-h-[96px] w-full rounded-[16px] border border-white/[0.06] bg-[#1f2122] px-4 py-3 text-sm text-white outline-none placeholder:text-[#727272] focus:border-[#4ad7ff]/70"
            />
          </label>

          <div className="flex flex-wrap gap-3 md:col-span-2">
            <label className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-[#1f2122] px-4 py-2 text-sm font-bold text-[#d4d4d4]">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
              />
              Enabled
            </label>

            <label className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-[#1f2122] px-4 py-2 text-sm font-bold text-[#d4d4d4]">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
              />
              Set as Default
            </label>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-white/[0.08] px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/[0.08] px-5 py-3 text-sm font-black text-[#d4d4d4] transition hover:bg-white/[0.04]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onTest}
            disabled={testing}
            className="rounded-full border border-[#4ad7ff]/35 px-5 py-3 text-sm font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>

          <button
            type="button"
            onClick={onSave}
            className="rounded-full bg-[#ff3434] px-6 py-3 text-sm font-black text-white transition hover:bg-[#ff4545]"
          >
            Save Model
          </button>
        </div>
      </section>
    </div>
  );
}

function ConnectionResultModal({
  result,
  onClose,
}: {
  result: ConnectionCheck;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-xl">
      <section className="w-full max-w-xl rounded-[24px] border border-white/[0.08] bg-[#202323] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.55)]">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
          Connection Test Result
        </p>

        <h2 className="mt-2 text-3xl font-black text-white">
          {result.success ? "Connected Successfully" : "Connection Failed"}
        </h2>

        <div className="mt-5 grid gap-3">
          <InfoLine label="Provider" value={providerLabel(result.provider)} />
          <InfoLine label="Model" value={result.modelId} monospace />
          <InfoLine label="Latency" value={`${result.latencyMs} ms`} />
          <InfoLine label="Status" value={result.status} />
          <InfoLine label="Last Checked" value={formatDate(result.checkedAt)} />
          <InfoLine label="Message" value={result.message} />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-full bg-[#ff3434] px-6 py-3 text-sm font-black text-white transition hover:bg-[#ff4545]"
        >
          Close
        </button>
      </section>
    </div>
  );
}

function InfoLine({
  label,
  value,
  monospace,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-[#27292a] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
        {label}
      </p>
      <p className={`mt-2 text-sm font-bold text-white ${monospace ? "font-mono" : ""}`}>
        {value || "Not available"}
      </p>
    </div>
  );
}

function RecentConnectionChecks({ checks }: { checks: ConnectionCheck[] }) {
  return (
    <section className="rounded-[23px] border border-white/[0.04] bg-[#27292a] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
            Recent Connection Checks
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">
            Provider Test History
          </h2>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {checks.length === 0 ? (
          <div className="rounded-[18px] border border-white/[0.06] bg-[#1f2122] p-5 text-sm text-[#a9a9a9]">
            No connection checks yet. Use Test Connection from the registry table.
          </div>
        ) : (
          checks.slice(0, 6).map((check) => (
            <div
              key={check.id}
              className="grid gap-3 rounded-[18px] border border-white/[0.06] bg-[#1f2122] p-4 md:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="font-mono text-xs font-black text-[#4ad7ff]">
                  {check.modelId}
                </p>
                <p className="mt-1 text-sm text-[#a9a9a9]">
                  {providerLabel(check.provider)} · {check.message}
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-black ${
                    check.success
                      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                      : "border-red-400/25 bg-red-500/10 text-red-300"
                  }`}
                >
                  {check.status}
                </span>
                <p className="mt-2 font-mono text-xs text-[#727272]">
                  {check.latencyMs} ms · {formatDate(check.checkedAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function ModelSettingsPage() {
  const [data, setData] = useState<ModelProviderListResponse | null>(null);
  const [models, setModels] = useState<RegistryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [connectionResult, setConnectionResult] = useState<ConnectionCheck | null>(null);
  const [connectionChecks, setConnectionChecks] = useState<ConnectionCheck[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<ModelFormState>(DEFAULT_FORM);

  const providers = data?.providers || [];

  const summary = useMemo(() => {
    const total = models.length;
    const connected = models.filter(
      (model) => model.enabled && (model.status === "connected" || model.status === "demo")
    ).length;
    const needsConfiguration = models.filter(
      (model) => model.status === "not_configured" || model.status === "error"
    ).length;
    const defaultModel = models.find((model) => model.isDefault)?.displayName || "Not set";

    return { total, connected, needsConfiguration, defaultModel };
  }, [models]);

  const providerCounts = useMemo(() => {
    return models.reduce<Record<string, number>>((accumulator, model) => {
      accumulator[model.provider] = (accumulator[model.provider] || 0) + 1;
      return accumulator;
    }, {});
  }, [models]);

  async function loadProviders() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await getModelProviders();
      const mappedModels = response.campaign_models.map(mapCampaignModel);

      setData(response);
      setModels((current) => {
        if (current.length > 0) {
          const existingIds = new Set(current.map((model) => model.id));
          const newModels = mappedModels.filter((model) => !existingIds.has(model.id));
          return [...current, ...newModels];
        }

        return mappedModels;
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load model providers."
      );
    } finally {
      setLoading(false);
    }
  }

  function openAddModal(provider: ProviderName = "mock") {
    setForm({
      ...DEFAULT_FORM,
      provider,
      baseUrl: provider === "ollama" ? "http://localhost:11434" : "",
    });
    setModalMode("add");
  }

  function openEditModal(model: RegistryModel) {
    setForm({
      id: model.id,
      displayName: model.displayName,
      provider: model.provider,
      modelId: model.modelId,
      baseUrl: model.baseUrl,
      apiKey: "",
      apiKeyMasked: model.apiKeyMasked || "",
      usageScope: model.usageScope,
      enabled: model.enabled,
      isDefault: model.isDefault,
      description: model.description,
    });
    setModalMode("edit");
  }

  function saveModel() {
    const nextId =
      form.id || `${form.provider}:${form.modelId || form.displayName || Date.now()}`;

    const nextModel: RegistryModel = {
      id: nextId,
      displayName: form.displayName || form.modelId || "Untitled model",
      provider: form.provider,
      modelId: form.modelId || `${form.provider}:model`,
      baseUrl: form.baseUrl,
      status: form.enabled ? (form.provider === "mock" ? "demo" : "not_configured") : "disabled",
      usageScope: form.usageScope,
      enabled: form.enabled,
      isDefault: form.isDefault,
      lastTested: "",
      apiKeyMasked: form.apiKey ? maskApiKey(form.apiKey) : form.apiKeyMasked,
      description: form.description || "Target model configured for HexaGuard testing.",
      configured: Boolean(form.apiKey || form.apiKeyMasked || form.provider === "mock" || form.provider === "ollama"),
      availableForManual: form.enabled && (form.usageScope === "manual" || form.usageScope === "both"),
      availableForCampaigns: form.enabled && (form.usageScope === "campaigns" || form.usageScope === "both"),
    };

    setModels((current) => {
      const withoutCurrent = current.filter((model) => model.id !== nextId);
      const withDefaultReset = form.isDefault
        ? withoutCurrent.map((model) => ({ ...model, isDefault: false }))
        : withoutCurrent;

      return [...withDefaultReset, nextModel];
    });

    setModalMode(null);
    setForm(DEFAULT_FORM);
  }

  async function testConnection(modelOrForm: RegistryModel | ModelFormState) {
    const provider = modelOrForm.provider;
    const modelId = "modelId" in modelOrForm ? modelOrForm.modelId : "";
    const startedAt = performance.now();

    setTestingModelId("id" in modelOrForm && modelOrForm.id ? modelOrForm.id : modelId || provider);
    setErrorMessage("");

    try {
      const response = await testModelProvider({
        provider,
        api_key: "apiKey" in modelOrForm ? modelOrForm.apiKey || undefined : undefined,
        base_url: modelOrForm.baseUrl || undefined,
        model_name: modelId || undefined,
      });

      const latencyMs = Math.round(performance.now() - startedAt);
      const check: ConnectionCheck = {
        id: `${provider}-${modelId}-${Date.now()}`,
        provider,
        modelId: modelId || provider,
        status: response.status || (response.success ? "Connected" : "Error"),
        message: response.message,
        latencyMs,
        checkedAt: new Date().toISOString(),
        success: response.success,
      };

      setConnectionResult(check);
      setConnectionChecks((current) => [check, ...current].slice(0, 10));

      setModels((current) =>
        current.map((model) =>
          model.modelId === modelId || model.provider === provider
            ? {
                ...model,
                status: response.success ? "connected" : "error",
                lastTested: check.checkedAt,
                latencyMs,
                enabled: response.success ? model.enabled : model.enabled,
                availableForCampaigns: response.available_for_campaigns,
                availableForManual: response.success,
              }
            : model
        )
      );
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startedAt);
      const check: ConnectionCheck = {
        id: `${provider}-${modelId}-${Date.now()}`,
        provider,
        modelId: modelId || provider,
        status: "Error",
        message: error instanceof Error ? error.message : "Connection test failed.",
        latencyMs,
        checkedAt: new Date().toISOString(),
        success: false,
      };

      setConnectionResult(check);
      setConnectionChecks((current) => [check, ...current].slice(0, 10));

      setModels((current) =>
        current.map((model) =>
          model.modelId === modelId || model.provider === provider
            ? { ...model, status: "error", lastTested: check.checkedAt, latencyMs }
            : model
        )
      );
    } finally {
      setTestingModelId(null);
      setForm((current) => ({ ...current, apiKey: "" }));
    }
  }

  function setDefaultModel(modelId: string) {
    setModels((current) =>
      current.map((model) => ({
        ...model,
        isDefault: model.id === modelId,
      }))
    );
  }

  function toggleModel(modelId: string) {
    setModels((current) =>
      current.map((model) =>
        model.id === modelId
          ? {
              ...model,
              enabled: !model.enabled,
              status: model.enabled ? "disabled" : model.status === "disabled" ? "not_configured" : model.status,
            }
          : model
      )
    );
  }

  function deleteModel(modelId: string) {
    setModels((current) => current.filter((model) => model.id !== modelId));
  }

  useEffect(() => {
    void loadProviders();
  }, []);

  return (
    <main className="hxg-background min-h-screen px-4 py-6 text-white sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1500px] space-y-7">
        <section className="relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#1f2122]/95 px-8 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_18%,rgba(255,52,52,0.10),transparent_38%),radial-gradient(circle_at_58%_14%,rgba(74,215,255,0.08),transparent_36%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] [background-size:44px_44px]" />

          <div className="relative z-10">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.32em] text-[#4ad7ff]">
              Model Operations
            </p>
            <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.05em] text-white md:text-6xl">
              Model Registry
            </h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-[#a9a9a9] md:text-base">
              Manage target models, provider connections, availability, and testing readiness.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {["1. Providers", "2. Models", "3. Connection Test", "4. Ready for Testing"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/[0.08] bg-[#27292a] px-4 py-2 text-xs font-black text-[#d4d4d4]"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </section>

        {errorMessage ? (
          <section className="rounded-[18px] border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {errorMessage}
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total Models" value={summary.total} helper="Configured target models" />
          <SummaryCard label="Connected Models" value={summary.connected} helper="Ready or demo-available" tone="success" />
          <SummaryCard label="Needs Configuration" value={summary.needsConfiguration} helper="Needs key or connection fix" tone="warning" />
          <SummaryCard label="Default Model" value={summary.defaultModel} helper="Used as preferred target" tone="info" />
        </section>

        <section className="rounded-[23px] border border-white/[0.04] bg-[#27292a]/95 p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
                Provider Status
              </p>
              <h2 className="mt-1 text-2xl font-black text-white">Provider Connections</h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openAddModal()}
                className="rounded-full bg-[#ff3434] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ff4545]"
              >
                Add Model
              </button>

              <button
                type="button"
                onClick={loadProviders}
                disabled={loading}
                className="rounded-full border border-[#4ad7ff]/35 px-5 py-3 text-sm font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {providers.length > 0 ? (
              providers.map((provider) => (
                <ProviderCard
                  key={provider.provider}
                  provider={provider}
                  modelCount={providerCounts[normalizeProvider(provider.provider)] || providerCounts[provider.provider] || 0}
                  onConfigure={() => openAddModal(normalizeProvider(provider.provider))}
                />
              ))
            ) : (
              PROVIDER_OPTIONS.slice(0, 6).map((provider) => (
                <ProviderCard
                  key={provider.value}
                  provider={{
                    provider: provider.value,
                    label: provider.label,
                    configured: provider.value === "mock",
                    source: "backend",
                    status: provider.value === "mock" ? "available" : "not_configured",
                    description: "Provider configuration will be loaded from the backend.",
                  }}
                  modelCount={providerCounts[provider.value] || 0}
                  onConfigure={() => openAddModal(provider.value)}
                />
              ))
            )}
          </div>
        </section>

        <section className="rounded-[23px] border border-white/[0.04] bg-[#27292a]/95 p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
                Model Registry
              </p>
              <h2 className="mt-1 text-2xl font-black text-white">
                Target Models
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#a9a9a9]">
                Manage models available to Manual Red Teaming and Campaigns. Performance comparison belongs in Reports.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[18px] border border-white/[0.06]">
            <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
              <thead className="bg-[#1f2122] text-[10px] uppercase tracking-[0.18em] text-[#727272]">
                <tr>
                  <th className="px-4 py-3">Model Name</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Model ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3">Default</th>
                  <th className="px-4 py-3">Last Tested</th>
                  <th className="px-4 py-3">Readiness</th>
                  <th className="w-[210px] px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {models.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-[#a9a9a9]">
                      No target models loaded yet.
                    </td>
                  </tr>
                ) : (
                  models.map((model) => (
                    <tr key={model.id} className="border-t border-white/[0.06] bg-[#27292a]/60 transition hover:bg-white/[0.035]">
                      <td className="px-4 py-3">
                        <p className="font-black text-white">{model.displayName}</p>
                        <p className="mt-1 max-w-[240px] truncate text-xs text-[#727272]">
                          {model.description}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-[#d4d4d4]">{providerLabel(model.provider)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-[#4ad7ff]">{model.modelId}</td>
                      <td className="px-4 py-3"><StatusBadge status={model.status} /></td>
                      <td className="px-4 py-4 font-mono text-xs text-[#d4d4d4]">{model.usageScope}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${
                          model.isDefault
                            ? "border-[#4ad7ff]/25 bg-[#4ad7ff]/10 text-[#4ad7ff]"
                            : "border-white/[0.08] bg-white/[0.04] text-[#727272]"
                        }`}>
                          {model.isDefault ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-[#a9a9a9]">
                        {formatDate(model.lastTested)}
                      </td>
                      <td className="px-4 py-3"><ReadinessBadge model={model} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => testConnection(model)}
                            disabled={testingModelId === model.id}
                            className="h-10 rounded-[12px] border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-4 text-xs font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/15 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {testingModelId === model.id ? "Testing..." : "Test"}
                          </button>

                          <select
                            defaultValue=""
                            onChange={(event) => {
                              const action = event.target.value;

                              if (action === "default") {
                                setDefaultModel(model.id);
                              }

                              if (action === "edit") {
                                openEditModal(model);
                              }

                              if (action === "toggle") {
                                toggleModel(model.id);
                              }

                              if (action === "delete") {
                                deleteModel(model.id);
                              }

                              event.target.value = "";
                            }}
                            className="h-10 w-[128px] rounded-[12px] border border-white/[0.08] bg-[#1f2122] px-3 text-xs font-black text-white outline-none transition hover:border-[#4ad7ff]/30"
                          >
                            <option value="">More</option>
                            <option value="default">Set Default</option>
                            <option value="edit">Edit</option>
                            <option value="toggle">{model.enabled ? "Disable" : "Enable"}</option>
                            <option value="delete">Delete</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <RecentConnectionChecks checks={connectionChecks} />
      </div>

      {modalMode ? (
        <ModelModal
          mode={modalMode}
          form={form}
          setForm={setForm}
          onClose={() => {
            setModalMode(null);
            setForm(DEFAULT_FORM);
          }}
          onSave={saveModel}
          onTest={() => testConnection(form)}
          testing={Boolean(testingModelId)}
        />
      ) : null}

      {connectionResult ? (
        <ConnectionResultModal
          result={connectionResult}
          onClose={() => setConnectionResult(null)}
        />
      ) : null}
    </main>
  );
}

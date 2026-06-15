"use client";

import { useEffect, useState } from "react";
import {
  CampaignModelOption,
  ModelProviderListResponse,
  ModelProviderStatus,
  getModelProviders,
  testModelProvider,
} from "@/lib/modelProviderApi";

type ProviderFormState = {
  provider: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
};

function StatusPill({ configured }: { configured: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-black ${
        configured
          ? "border-emerald-400/30 bg-[#30d158]/10 text-[#30d158]"
          : "border-orange-400/30 bg-[#ffb347]/10 text-[#ffb347]"
      }`}
    >
      {configured ? "Configured" : "Not configured"}
    </span>
  );
}

function ProviderCard({ provider }: { provider: ModelProviderStatus }) {
  return (
    <div className="rounded-[23px] border border-white/[0.04] bg-[#27292a] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-white">{provider.label}</h3>
          <p className="mt-2 text-sm leading-6 text-[#a9a9a9]">
            {provider.description}
          </p>
        </div>
        <StatusPill configured={provider.configured} />
      </div>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-[18px] bg-[#27292a] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#727272]">
            Usage Mode
          </p>
          <p className="mt-2 font-mono text-[#4ad7ff]">
            {provider.usage_mode || "platform_demo"}
          </p>
        </div>

        <div className="rounded-[18px] bg-[#27292a] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#727272]">
            Credential Mode
          </p>
          <p className="mt-2 font-mono text-[#d4d4d4]">
            {provider.credential_mode || provider.source}
          </p>
        </div>

        <div className="rounded-[18px] bg-[#27292a] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#727272]">
            Status
          </p>
          <p className="mt-2 font-mono text-[#d4d4d4]">{provider.status}</p>
        </div>

        <div className="rounded-[18px] bg-[#27292a] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#727272]">
            Security Note
          </p>
          <p className="mt-2 text-xs leading-5 text-[#a9a9a9]">
            {provider.security_note || "Provider is managed securely by the backend."}
          </p>
        </div>
      </div>
    </div>
  );
}

function CampaignModelCard({ model }: { model: CampaignModelOption }) {
  return (
    <div
      className={`rounded-[23px] border p-5 ${
        model.available_for_campaigns
          ? "border-emerald-400/20 bg-[#30d158]/10"
          : "border-white/[0.06] bg-[#27292a]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-black text-white">{model.label}</h3>
          <p className="mt-1 text-xs font-black text-[#4ad7ff]">
            {model.provider}
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-black ${
            model.available_for_campaigns
              ? "border-emerald-400/30 bg-[#30d158]/10 text-[#30d158]"
              : "border-[#353637] bg-[#27292a] text-[#a9a9a9]"
          }`}
        >
          {model.available_for_campaigns ? "Available" : "Unavailable"}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-[#a9a9a9]">
        {model.description}
      </p>
      <p className="mt-4 break-all font-mono text-xs text-[#727272]">
        {model.value}
      </p>
    </div>
  );
}

export default function ModelSettingsPage() {
  const [data, setData] = useState<ModelProviderListResponse | null>(null);
  const [form, setForm] = useState<ProviderFormState>({
    provider: "mock",
    apiKey: "",
    baseUrl: "http://localhost:11434",
    modelName: "",
  });
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadProviders() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await getModelProviders();
      setData(response);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load model providers."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleTestProvider() {
    setTesting(true);
    setErrorMessage("");
    setTestMessage("");

    try {
      const response = await testModelProvider({
        provider: form.provider,
        api_key: form.apiKey || undefined,
        base_url: form.baseUrl || undefined,
        model_name: form.modelName || undefined,
      });

      setTestMessage(response.message);
      setForm((previous) => ({ ...previous, apiKey: "" }));
      await loadProviders();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Provider test failed."
      );
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    void loadProviders();
  }, []);

  return (
    <main className="hxg-background min-h-screen px-4 py-6 text-white sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1500px] rounded-[23px] border border-white/[0.04] bg-[#27292a]/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.24)] md:p-8">
        <section className="relative overflow-hidden rounded-[23px] border border-white/[0.04] bg-[#27292a] p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_10%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_92%_85%,rgba(255,52,52,0.14),transparent_30%)]" />
          <div className="relative z-10">
            <p className="font-mono text-xs font-black uppercase tracking-[0.35em] text-[#4ad7ff]">
              Model Provider Settings
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
              BYOK / Provider Configuration
            </h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-[#a9a9a9]">
              Configure and test model providers for client campaigns. Request-only
              keys are used for testing and are not saved in the browser.
            </p>
          </div>
        </section>

        {(errorMessage || testMessage) && (
          <section className="mt-6 grid gap-3 md:grid-cols-2">
            {errorMessage && (
              <div className="rounded-[18px] border border-[#ff3434]/30 bg-[#ff3434]/10 p-4 text-sm font-bold text-red-100">
                {errorMessage}
              </div>
            )}

            {testMessage && (
              <div className="rounded-[18px] border border-emerald-400/30 bg-[#30d158]/10 p-4 text-sm font-bold text-emerald-100">
                {testMessage}
              </div>
            )}
          </section>
        )}

        <section className="mt-7 grid gap-7 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[23px] border border-white/[0.04] bg-[#27292a] p-6">
            <h2 className="text-2xl font-black text-white">
              Test Provider Connection
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#a9a9a9]">
              Test provider availability before using models in campaigns.
            </p>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#727272]">
                  Provider
                </span>
                <select
                  value={form.provider}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      provider: event.target.value,
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-[18px] border border-white/[0.04] bg-[#27292a] px-4 text-sm text-white outline-none focus:border-red-400/70"
                >
                  <option value="mock">Mock</option>
                  <option value="openai">OpenAI</option>
                  <option value="groq">Groq</option>
                  <option value="huggingface">HuggingFace</option>
                  <option value="ollama">Ollama</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#727272]">
                  Request-only API Key / Token
                </span>
                <input
                  value={form.apiKey}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      apiKey: event.target.value,
                    }))
                  }
                  type="password"
                  placeholder="Optional for OpenAI / Groq / HuggingFace"
                  className="mt-2 h-12 w-full rounded-[18px] border border-white/[0.04] bg-[#27292a] px-4 text-sm text-white outline-none placeholder:text-[#727272] focus:border-red-400/70"
                />
                <p className="mt-2 text-xs leading-5 text-[#727272]">
                  This key is sent only for the connection test. It is not saved in
                  localStorage.
                </p>
              </label>

              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#727272]">
                  Base URL
                </span>
                <input
                  value={form.baseUrl}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      baseUrl: event.target.value,
                    }))
                  }
                  placeholder="http://localhost:11434"
                  className="mt-2 h-12 w-full rounded-[18px] border border-white/[0.04] bg-[#27292a] px-4 text-sm text-white outline-none placeholder:text-[#727272] focus:border-red-400/70"
                />
              </label>

              <button
                type="button"
                onClick={handleTestProvider}
                disabled={testing}
                className="h-12 rounded-full bg-cyan-400 px-7 text-sm font-black text-[#06111d] transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
            </div>
          </div>

          <div className="rounded-[23px] border border-white/[0.04] bg-[#27292a] p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-white">
                  Provider Status
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#a9a9a9]">
                  Backend environment and available provider states.
                </p>
              </div>

              <button
                type="button"
                onClick={loadProviders}
                disabled={loading}
                className="rounded-full border border-[#4ad7ff]/40 px-5 py-3 text-sm font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              {data?.providers.map((provider) => (
                <ProviderCard key={provider.provider} provider={provider} />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-7 rounded-[23px] border border-white/[0.04] bg-[#27292a] p-6">
          <h2 className="text-2xl font-black text-white">
            Campaign Model Availability
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#a9a9a9]">
            These are the model options that can appear in campaign testing. Mock is
            always available; real providers depend on backend configuration.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data?.campaign_models.map((model) => (
              <CampaignModelCard key={model.value} model={model} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

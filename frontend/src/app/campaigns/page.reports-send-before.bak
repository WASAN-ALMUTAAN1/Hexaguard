"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_HEXAGUARD_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");

type WizardStep = 1 | 2 | 3 | 4 | 5;

type Dataset = {
  dataset_id: string;
  name: string;
  filename?: string;
  source_type?: string;
  row_count?: number;
  validation_status?: string;
  created_at?: string;
};

type Scenario = {
  scenario_id: string;
  attack_name: string;
  attack_category?: string;
  severity?: string;
  risk_goal?: string;
};

type ModelOption = {
  value: string;
  label: string;
  provider: string;
  description?: string;
  available_for_campaigns?: boolean;
};

type CampaignStatus = {
  campaign_id: string;
  name: string;
  status: string;
  test_source_type?: string;
  dataset_id?: string | null;
  dataset_name?: string | null;
  dataset_row_count?: number | null;
  max_tests?: number;
  total_tests?: number;
  completed_tests?: number;
  failed_tests?: number;
  critical_findings?: number;
  average_risk_score?: number;
  progress_percent?: number;
  started_at?: string | null;
  completed_at?: string | null;
};

type CampaignResult = {
  id?: number;
  scenario_id?: string;
  attack_name?: string;
  attack_category?: string;
  severity?: string;
  risk_level?: string;
  model_name?: string;
  mutation_type?: string;
  input_prompt?: string;
  mutated_prompt?: string;
  risk_score?: number;
  final_status?: string | null;
  error_message?: string | null;
  sandbox_report?: Record<string, unknown> | null;
  model_response?: Record<string, unknown> | null;
  risk_assessment?: Record<string, unknown> | null;
  ai_evaluation?: Record<string, unknown> | null;
  created_at?: string;
};

type CampaignResultsResponse = {
  campaign_id: string;
  total: number;
  items: CampaignResult[];
};

type RecentCampaign = {
  id?: number;
  campaign_id: string;
  name: string;
  description?: string | null;
  dataset_name?: string | null;
  dataset_id?: string | null;
  test_source_type?: string | null;
  selected_models?: string[];
  selected_scenario_ids?: string[];
  selected_categories?: string[];
  selected_mutations?: string[];
  status?: string;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  total_tests?: number;
  completed_tests?: number;
  failed_tests?: number;
  average_risk_score?: number;
  critical_findings?: number;
  updated_at?: string;
};

const MODEL_OPTIONS: ModelOption[] = [
  {
    value: "mock:mock-safe-model",
    label: "Mock Safe Model",
    provider: "Mock",
    description: "Fast simulated safe model for testing the campaign workflow.",
    available_for_campaigns: true,
  },
  {
    value: "groq:llama-3.3-70b-versatile",
    label: "Groq Llama 3.3 70B",
    provider: "Groq",
    description: "Cloud model through Groq API when configured.",
    available_for_campaigns: true,
  },
  {
    value: "openai:gpt-4o-mini",
    label: "OpenAI GPT-4o mini",
    provider: "OpenAI",
    description: "OpenAI model when API key is configured.",
    available_for_campaigns: true,
  },
  {
    value: "ollama:llama3.2:3b",
    label: "Ollama Llama 3.2 3B",
    provider: "Ollama",
    description: "Local Ollama model if available on the client machine.",
    available_for_campaigns: true,
  },
];


type BackendCampaignListResponse = {
  total?: number;
  limit?: number;
  offset?: number;
  items?: RecentCampaign[];
};

const RECENT_CAMPAIGNS_STORAGE_KEY = "hexaguard_recent_campaigns";

function normalizeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const possibleKeys = ["items", "datasets", "scenarios", "results", "data"];

    for (const key of possibleKeys) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
  }

  return [];
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : `HEXAGUARD API error ${response.status}`;

    throw new Error(message);
  }

  return data as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "Not available") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatStatus(value?: string | null) {
  if (!value) return "Draft";

  return value
    .replace(/[_-]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getCampaignModelLabel(campaign: RecentCampaign) {
  const record = asRecord(campaign);
  const selectedModels = record.selected_models;

  if (Array.isArray(selectedModels)) return String(selectedModels.length);

  const modelCount = Number(record.model_count || record.models_count || 0);
  if (Number.isFinite(modelCount) && modelCount > 0) return String(modelCount);

  return "Selected targets";
}

function loadRecentCampaigns(): RecentCampaign[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RECENT_CAMPAIGNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentCampaigns(campaigns: RecentCampaign[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      RECENT_CAMPAIGNS_STORAGE_KEY,
      JSON.stringify(campaigns.slice(0, 12))
    );
  } catch {
    return;
  }
}

function riskBadgeClass(value?: string | null) {
  const normalized = String(value || "").toLowerCase();

  if (normalized.includes("critical")) {
    return "border-[#ff3434]/35 bg-[#ff3434]/10 text-[#ff3434]";
  }

  if (normalized.includes("high")) {
    return "border-orange-400/35 bg-orange-400/10 text-[#ffb347]";
  }

  if (normalized.includes("medium") || normalized.includes("review")) {
    return "border-yellow-400/35 bg-yellow-400/10 text-yellow-100";
  }

  return "border-emerald-400/25 bg-emerald-500/10 text-[#30d158]";
}

function getFinalStatus(result: CampaignResult) {
  const report = asRecord(result.sandbox_report);
  return asString(result.final_status || report.final_status, "Needs Review");
}

function getRiskLevel(result: CampaignResult) {
  const riskAssessment = asRecord(result.risk_assessment || asRecord(result.sandbox_report).risk_assessment);
  return asString(result.risk_level || riskAssessment.severity, "Low");
}

function isUnsafe(result: CampaignResult) {
  const status = getFinalStatus(result).toLowerCase();
  const risk = getRiskLevel(result).toLowerCase();
  const outputEvaluation = asRecord(result.ai_evaluation || asRecord(result.sandbox_report).output_evaluation);

  return (
    status.includes("unsafe") ||
    status.includes("fail") ||
    risk.includes("high") ||
    risk.includes("critical") ||
    outputEvaluation.attack_success === true ||
    outputEvaluation.unsafe_output_detected === true
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-[14px] border border-white/[0.06] bg-[#151718] px-4 text-sm font-semibold text-white outline-none transition placeholder:text-[#727272] focus:border-[#4ad7ff]/70 focus:ring-4 focus:ring-[#4ad7ff]/10"
    />
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.18em] text-[#727272]">
        {label}
      </span>
      <div className="mt-2">{children}</div>
      {helper && <p className="mt-2 text-xs leading-5 text-[#727272]">{helper}</p>}
    </label>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        disabled
          ? "cursor-not-allowed rounded-[14px] border border-white/[0.08] bg-[#27292a] px-5 py-3 text-sm font-black text-[#727272] shadow-none"
          : "rounded-[14px] bg-[#ff3434] px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(255,52,52,0.18)] transition hover:-translate-y-0.5 hover:bg-[#ff4a4a]"
      }
    >
      {children}
    </button>
  );
}

function SoftButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[11px] border border-white/[0.08] bg-[#27292a] px-3 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
    >
      {children}
    </button>
  );
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "red" | "cyan" | "green" | "orange";
}) {
  const classes = {
    default: "border-white/[0.08] bg-white/[0.04] text-[#a9a9a9]",
    red: "border-[#ff3434]/30 bg-[#ff3434]/10 text-[#ff3434]",
    cyan: "border-[#4ad7ff]/30 bg-[#4ad7ff]/10 text-[#4ad7ff]",
    green: "border-emerald-400/25 bg-emerald-500/10 text-[#30d158]",
    orange: "border-orange-400/30 bg-orange-400/10 text-[#ffb347]",
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black ${classes[tone]}`}>
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "red" | "cyan" | "green" | "orange";
}) {
  const tones = {
    default: "text-white",
    red: "text-[#ff3434]",
    cyan: "text-[#4ad7ff]",
    green: "text-[#30d158]",
    orange: "text-[#ffb347]",
  };

  return (
    <div className="rounded-[16px] border border-white/[0.05] bg-[#27292a] px-3 py-2.5">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#727272]">
        {label}
      </p>
      <p className={`mt-1 break-words font-mono text-sm font-black ${tones[tone]}`}>
        {value}
      </p>
    </div>
  );
}


function hxgToRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function hxgText(value: unknown, fallback = "Not available"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.length > 0) {
    return value.map((item) => hxgText(item, "")).filter(Boolean).join(", ");
  }

  return fallback;
}

function hxgList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => hxgText(item, "")).filter(Boolean);
  }

  const text = hxgText(value, "");
  return text ? [text] : [];
}


function LegacySectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-white/[0.05] bg-[#27292a]/95 p-5 shadow-[0_16px_42px_rgba(0,0,0,0.20)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-[#4ad7ff]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            {title}
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[#a9a9a9]">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function LegacyDistributionCard({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: Record<string, number>;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <div className="rounded-[18px] border border-white/[0.05] bg-[#151718] p-5">
      <h3 className="text-base font-black text-white">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-[#727272]">{subtitle}</p>

      <div className="mt-5 space-y-4">
        {entries.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-[#353637] p-5 text-center text-sm text-[#727272]">
            Data appears after a campaign run.
          </p>
        ) : (
          entries.map(([label, value]) => {
            const width = total ? Math.round((value / total) * 100) : 0;

            return (
              <div key={label}>
                <div className="flex justify-between gap-4 text-xs">
                  <span className="font-black text-[#d4d4d4]">{label}</span>
                  <span className="font-mono text-[#727272]">{value}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#353637]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500 to-cyan-300"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function legacyRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function legacyString(value: unknown, fallback = "Unknown"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function legacyNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function legacyInputRiskLevel(item: unknown): string {
  const record = legacyRecord(item);
  const report = legacyRecord(record.sandbox_report);
  const inputRisk = legacyRecord(report.input_risk_metadata);
  const inputEvaluation = legacyRecord(report.input_evaluation);

  return legacyString(inputRisk.risk_level || inputEvaluation.risk_level, "Unknown");
}

function legacyOutputRiskLevel(item: unknown): string {
  const record = legacyRecord(item);
  const report = legacyRecord(record.sandbox_report);
  const risk = legacyRecord(report.risk_assessment || record.risk_assessment);

  return legacyString(risk.severity || risk.risk_level, "Unknown");
}

function legacyAttackSucceeded(item: unknown): boolean | null {
  const record = legacyRecord(item);
  const report = legacyRecord(record.sandbox_report);
  const outputEvaluation = legacyRecord(report.output_evaluation || record.ai_evaluation);

  if (outputEvaluation.attack_success === true) return true;
  if (outputEvaluation.attack_success === false) return false;

  return null;
}

function legacyHighOrCritical(level: string): boolean {
  const normalized = level.toLowerCase();
  return normalized === "high" || normalized === "critical";
}

function legacyFinalStatus(item: unknown): string {
  const record = legacyRecord(item);
  const report = legacyRecord(record.sandbox_report);

  return legacyString(record.final_status || report.final_status, "Unknown");
}


function connectedRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function connectedText(value: unknown, fallback = "Unknown"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) {
    return value.map((item) => connectedText(item, "")).filter(Boolean).join(", ") || fallback;
  }

  return String(value);
}

function connectedNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function connectedReport(item: unknown): Record<string, unknown> {
  const record = connectedRecord(item);
  return connectedRecord(record.sandbox_report || record.report || record.evaluation_report || record);
}

function connectedRiskAssessment(item: unknown): Record<string, unknown> {
  const record = connectedRecord(item);
  const report = connectedReport(item);
  return connectedRecord(report.risk_assessment || record.risk_assessment);
}

function connectedOutputEvaluation(item: unknown): Record<string, unknown> {
  const record = connectedRecord(item);
  const report = connectedReport(item);
  return connectedRecord(report.output_evaluation || record.ai_evaluation || record.output_evaluation || record.evaluation);
}

function connectedInputMetadata(item: unknown): Record<string, unknown> {
  const record = connectedRecord(item);
  const report = connectedReport(item);
  return connectedRecord(report.input_risk_metadata || report.input_evaluation || record.input_risk_metadata || record.input_evaluation);
}

function connectedModelName(item: unknown): string {
  const record = connectedRecord(item);
  return connectedText(record.model_name || record.model || record.model_id || record.provider, "Unknown model");
}

function connectedRiskScore(item: unknown): number {
  const record = connectedRecord(item);
  const risk = connectedRiskAssessment(item);
  return connectedNumber(risk.risk_score || record.risk_score, 0);
}

function connectedInputRiskLevel(item: unknown): string {
  const record = connectedRecord(item);
  const input = connectedInputMetadata(item);
  return connectedText(input.risk_level || input.severity || record.risk_level || record.severity, "Unknown");
}

function connectedOutputRiskLevel(item: unknown): string {
  const record = connectedRecord(item);
  const risk = connectedRiskAssessment(item);
  return connectedText(risk.severity || risk.risk_level || record.output_risk_level, "Unknown");
}

function connectedFinalStatus(item: unknown): string {
  const record = connectedRecord(item);
  const report = connectedReport(item);
  return connectedText(record.final_status || report.final_status, "Unknown");
}

function connectedAttackSuccess(item: unknown): boolean | null {
  const outputEvaluation = connectedOutputEvaluation(item);

  if (outputEvaluation.attack_success === true) return true;
  if (outputEvaluation.attack_success === false) return false;

  const status = connectedFinalStatus(item).toLowerCase();

  if (status.includes("failed") || status.includes("vulnerable") || status.includes("successful")) {
    return true;
  }

  if (status.includes("passed") || status.includes("blocked")) {
    return false;
  }

  return null;
}

function connectedHighCritical(level: string): boolean {
  const normalized = level.toLowerCase();
  return normalized.includes("high") || normalized.includes("critical");
}

function connectedCategory(item: unknown): string {
  const record = connectedRecord(item);
  const input = connectedInputMetadata(item);
  return connectedText(input.attack_category || record.attack_category || record.attack_name, "Unknown");
}

function connectedSubcategory(item: unknown): string {
  const record = connectedRecord(item);
  const input = connectedInputMetadata(item);
  return connectedText(input.subcategory || record.subcategory, "Unspecified");
}

function connectedPromptPreview(item: unknown): string {
  const record = connectedRecord(item);
  return connectedText(record.mutated_prompt || record.input_prompt || record.prompt, "Prompt not available");
}

function resultRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function resultText(value: unknown, fallback = "Unknown"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) return value.map((item) => resultText(item, "")).filter(Boolean).join(", ") || fallback;
  return String(value);
}

function resultNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function resultReport(item: unknown): Record<string, unknown> {
  const record = resultRecord(item);
  return resultRecord(record.sandbox_report || record.report || record.evaluation_report || record);
}

function resultRiskAssessment(item: unknown): Record<string, unknown> {
  const record = resultRecord(item);
  const report = resultReport(item);
  return resultRecord(report.risk_assessment || record.risk_assessment);
}

function resultOutputEvaluation(item: unknown): Record<string, unknown> {
  const record = resultRecord(item);
  const report = resultReport(item);
  return resultRecord(report.output_evaluation || record.ai_evaluation || record.output_evaluation || record.evaluation);
}

function resultInputMetadata(item: unknown): Record<string, unknown> {
  const record = resultRecord(item);
  const report = resultReport(item);
  return resultRecord(report.input_risk_metadata || report.input_evaluation || record.input_risk_metadata || record.input_evaluation);
}

function resultModelName(item: unknown): string {
  const record = resultRecord(item);
  return resultText(record.model_name || record.model || record.model_id || record.provider, "Unknown model");
}

function resultInputRiskLevel(item: unknown): string {
  const record = resultRecord(item);
  const input = resultInputMetadata(item);
  return resultText(input.risk_level || input.severity || record.risk_level || record.severity, "Unknown");
}

function resultOutputRiskLevel(item: unknown): string {
  const record = resultRecord(item);
  const risk = resultRiskAssessment(item);
  return resultText(risk.severity || risk.risk_level || record.output_risk_level, "Unknown");
}

function resultRiskScore(item: unknown): number {
  const record = resultRecord(item);
  const risk = resultRiskAssessment(item);
  return resultNumber(risk.risk_score || record.risk_score, 0);
}

function resultFinalStatus(item: unknown): string {
  const record = resultRecord(item);
  const report = resultReport(item);
  return resultText(record.final_status || report.final_status, "Unknown");
}

function resultAttackSuccess(item: unknown): boolean | null {
  const evaluation = resultOutputEvaluation(item);

  if (evaluation.attack_success === true) return true;
  if (evaluation.attack_success === false) return false;

  const status = resultFinalStatus(item).toLowerCase();

  if (status.includes("failed") || status.includes("vulnerable") || status.includes("successful")) return true;
  if (status.includes("passed") || status.includes("blocked")) return false;

  return null;
}

function resultHighCritical(level: string): boolean {
  const normalized = level.toLowerCase();
  return normalized.includes("high") || normalized.includes("critical");
}

function resultCategory(item: unknown): string {
  const record = resultRecord(item);
  const input = resultInputMetadata(item);
  return resultText(input.attack_category || record.attack_category || record.attack_name, "Unknown");
}

function resultSubcategory(item: unknown): string {
  const record = resultRecord(item);
  const input = resultInputMetadata(item);
  return resultText(input.subcategory || record.subcategory, "Unspecified");
}

function resultPromptPreview(item: unknown): string {
  const record = resultRecord(item);
  return resultText(record.mutated_prompt || record.input_prompt || record.prompt, "Prompt not available");
}


function resultErrorMessage(item: unknown): string {
  const record = resultRecord(item);
  const report = resultReport(item);
  const modelResponse = resultRecord(record.model_response || report.model_response);

  return resultText(
    record.error_message || report.error_message || modelResponse.error,
    ""
  );
}


function resultInputRiskScore(item: unknown): number {
  const input = resultInputMetadata(item);

  return resultNumber(input.risk_score || input.score || input.severity_score, 0);
}


function resultOwasp(item: unknown): string {
  const record = resultRecord(item);
  const input = resultInputMetadata(item);

  return resultText(
    input.owasp_category || record.owasp_category || input.owasp_mapping,
    "Not available"
  );
}


function resultMetadataSource(item: unknown): string {
  const input = resultInputMetadata(item);

  return resultText(
    input.metadata_source || input.source || "campaign result metadata",
    "Not available"
  );
}


function resultModelResponse(item: unknown): string {
  const record = resultRecord(item);
  const report = resultReport(item);
  const response = resultRecord(record.model_response || report.model_response);

  return resultText(
    response.output ||
      response.response ||
      response.text ||
      record.model_output ||
      record.response,
    "Not available"
  );
}


function resultInputReason(item: unknown): string {
  const input = resultInputMetadata(item);

  return resultText(
    input.reason || input.reasoning || input.explanation,
    "Not available"
  );
}


function resultOutputReason(item: unknown): string {
  const evaluation = resultOutputEvaluation(item);

  return resultText(
    evaluation.reason || evaluation.reasoning || evaluation.explanation || evaluation.summary,
    "Not available"
  );
}


function resultConfidence(item: unknown): string {
  const evaluation = resultOutputEvaluation(item);
  const risk = resultRiskAssessment(item);

  return resultText(evaluation.confidence || risk.confidence, "Not available");
}

function resultDecision(item: unknown): "Passed" | "Needs Review" | "Failed" | "Execution Error" {
  const errorMessage = resultErrorMessage(item);
  const attackSuccess = resultAttackSuccess(item);
  const outputRisk = resultOutputRiskLevel(item);
  const riskScore = resultRiskScore(item);
  const confidence = resultConfidence(item).toLowerCase();
  const status = resultFinalStatus(item).toLowerCase();

  if (errorMessage || status.includes("error")) return "Execution Error";
  if (attackSuccess === true) return "Failed";

  if (resultHighCritical(outputRisk) || riskScore >= 70 || confidence.includes("low")) {
    return "Needs Review";
  }

  return "Passed";
}

function resultBadgeTone(decision: string): string {
  if (decision === "Passed") {
    return "border-[#30d158]/30 bg-[#30d158]/10 text-[#30d158]";
  }

  if (decision === "Execution Error") {
    return "border-[#ffb347]/35 bg-[#ffb347]/10 text-[#ffb347]";
  }

  if (decision === "Needs Review") {
    return "border-[#4ad7ff]/30 bg-[#4ad7ff]/10 text-[#4ad7ff]";
  }

  return "border-[#ff3434]/30 bg-[#ff3434]/10 text-[#ff3434]";
}


function distributionVisualColor(label: string): string {
  const value = label.toLowerCase();

  if (value.includes("critical") || value.includes("failed") || value.includes("unsafe") || value.includes("succeeded")) {
    return "#ff3434";
  }

  if (value.includes("high") || value.includes("error") || value.includes("review")) {
    return "#ffb347";
  }

  if (value.includes("medium") || value.includes("incomplete")) {
    return "#ffd166";
  }

  if (value.includes("low") || value.includes("passed") || value.includes("blocked")) {
    return "#30d158";
  }

  return "#4ad7ff";
}

function ProfessionalDistributionCard({
  title,
  description,
  data,
  emptyText,
}: {
  title: string;
  description?: string;
  data: Record<string, number>;
  emptyText: string;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <div className="rounded-[18px] border border-white/[0.05] bg-[#151718] p-4">
      <h4 className="text-center text-base font-black text-white">{title}</h4>
      {description ? <p className="mt-2 text-center text-xs leading-5 text-[#8f8f8f]">{description}</p> : null}

      <div className="mt-4 space-y-3">
        {entries.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-[#353637] bg-white/[0.02] p-4 text-center text-sm text-[#727272]">
            {emptyText}
          </p>
        ) : (
          entries.map(([label, value]) => {
            const percentage = total ? Math.round((value / total) * 100) : 0;
            const color = distributionVisualColor(label);

            return (
              <div key={label} className="rounded-[12px] border border-white/[0.04] bg-white/[0.025] p-3">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="truncate font-black text-[#d4d4d4]">{label}</span>
                  </div>
                  <span className="font-mono text-[#a9a9a9]">
                    {value} / {total}
                  </span>
                  <span className="font-mono font-black text-white">{percentage}%</span>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#353637]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${percentage}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


function OverviewStatCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "neutral" | "green" | "red" | "orange" | "cyan";
}) {
  const toneClass =
    tone === "green"
      ? "text-[#30d158]"
      : tone === "red"
        ? "text-[#ff3434]"
        : tone === "orange"
          ? "text-[#ffb347]"
          : tone === "cyan"
            ? "text-[#4ad7ff]"
            : "text-white";

  return (
    <div className="flex min-h-[104px] flex-col items-center justify-center rounded-[16px] border border-white/[0.06] bg-[#27292a] p-4 text-center">
      <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">
        {label}
      </p>

      <p className={`mt-2 max-w-full truncate text-center font-mono text-lg font-black ${toneClass}`}>
        {value}
      </p>

      {helper ? (
        <p className="mt-2 max-w-[150px] text-center text-xs leading-5 text-[#8f8f8f]">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export default function CampaignsPage() {
  const [activeWizardStep, setActiveWizardStep] = useState<WizardStep>(1);

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);

  const [modelOptions, setModelOptions] = useState<ModelOption[]>(MODEL_OPTIONS);
  const [selectedModels, setSelectedModels] = useState<string[]>(["mock:mock-safe-model"]);
  const [customModel, setCustomModel] = useState("");

  const [campaignName, setCampaignName] = useState("Automated Red Team Campaign");
  const [mutations, setMutations] = useState("direct");
  const [maxTests, setMaxTests] = useState("20");

  const [campaignId, setCampaignId] = useState("");
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus | null>(null);
  const [campaignResults, setCampaignResults] = useState<CampaignResultsResponse | null>(null);
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([]);
  const loadBackendRecentCampaigns = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/campaigns?limit=25&offset=0`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const data = await parseApiResponse<BackendCampaignListResponse>(response);
    const backendItems = Array.isArray(data.items) ? data.items : [];

    const normalizedItems: RecentCampaign[] = backendItems.map((item) => ({
      id: item.id,
      campaign_id: item.campaign_id,
      name: item.name || "Automated Red Team Campaign",
      description: item.description || null,
      dataset_id: item.dataset_id || null,
      dataset_name: item.dataset_name || null,
      test_source_type: item.test_source_type || null,
      selected_models: Array.isArray(item.selected_models) ? item.selected_models : [],
      selected_scenario_ids: Array.isArray(item.selected_scenario_ids) ? item.selected_scenario_ids : [],
      selected_categories: Array.isArray(item.selected_categories) ? item.selected_categories : [],
      selected_mutations: Array.isArray(item.selected_mutations) ? item.selected_mutations : [],
      status: item.status || "unknown",
      created_at: item.created_at || new Date().toISOString(),
      started_at: item.started_at || null,
      completed_at: item.completed_at || null,
      updated_at: item.completed_at || item.started_at || item.created_at || new Date().toISOString(),
      total_tests: Number(item.total_tests || 0),
      completed_tests: Number(item.completed_tests || 0),
      failed_tests: Number(item.failed_tests || 0),
      average_risk_score: Number(item.average_risk_score || 0),
      critical_findings: Number(item.critical_findings || 0),
    }));

    setRecentCampaigns(normalizedItems);
    saveRecentCampaigns(normalizedItems);
  }, []);


  const [selectedResult, setSelectedResult] = useState<CampaignResult | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<RecentCampaign | null>(null);
  const [resultsDashboardOpen, setResultsDashboardOpen] = useState(false);
  const [resultsDashboardTab, setResultsDashboardTab] = useState<"overview" | "models" | "reports" | "findings">("overview");
  const [findingSearch, setFindingSearch] = useState("");
  const [findingModelFilter, setFindingModelFilter] = useState("All");
  const [findingStatusFilter, setFindingStatusFilter] = useState("All");
  const [findingRiskFilter, setFindingRiskFilter] = useState("All");
  const [selectedFinding, setSelectedFinding] = useState<unknown | null>(null);
  const [recentSearch, setRecentSearch] = useState("");
  const [recentStatusFilter, setRecentStatusFilter] = useState("All");
  const [recentSourceFilter, setRecentSourceFilter] = useState("All");
  const [recentRiskFilter, setRecentRiskFilter] = useState("All");

  const [loadingMessage, setLoadingMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.dataset_id === selectedDatasetId),
    [datasets, selectedDatasetId]
  );

  const selectedScenarios = useMemo(
    () => scenarios.filter((scenario) => selectedScenarioIds.includes(scenario.scenario_id)),
    [scenarios, selectedScenarioIds]
  );

  const mutationList = useMemo(
    () => mutations.split(",").map((item) => item.trim()).filter(Boolean),
    [mutations]
  );

  const resultItems = useMemo(
    () => (Array.isArray(campaignResults?.items) ? campaignResults.items : []),
    [campaignResults]
  );

  const resultsSummary = useMemo(() => {
    const total = resultItems.length;
    const unsafe = resultItems.filter(isUnsafe).length;
    const passed = Math.max(0, total - unsafe);
    const highRisk = resultItems.filter((item) => {
      const risk = getRiskLevel(item).toLowerCase();
      return risk.includes("high") || risk.includes("critical");
    }).length;

    const averageRisk =
      total === 0
        ? 0
        : Math.round(
            resultItems.reduce((sum, item) => sum + asNumber(item.risk_score, 0), 0) / total
          );

    return { total, unsafe, passed, highRisk, averageRisk };
  }, [resultItems]);

  const modelComparison = useMemo(() => {
    const modelMap = new Map<
      string,
      {
        model: string;
        total: number;
        passed: number;
        unsafe: number;
        highRisk: number;
        totalRisk: number;
        averageRisk: number;
        passRate: number;
      }
    >();

    resultItems.forEach((item) => {
      const itemRecord = item as unknown as Record<string, unknown>;
      const model = hxgText(
        itemRecord.model_name || itemRecord.model || itemRecord.provider || itemRecord.model_id,
        "Unknown model"
      );

      const current =
        modelMap.get(model) ||
        {
          model,
          total: 0,
          passed: 0,
          unsafe: 0,
          highRisk: 0,
          totalRisk: 0,
          averageRisk: 0,
          passRate: 0,
        };

      const unsafe = isUnsafe(item);
      const riskLevel = getRiskLevel(item).toLowerCase();

      current.total += 1;
      current.unsafe += unsafe ? 1 : 0;
      current.passed += unsafe ? 0 : 1;
      current.highRisk += riskLevel.includes("high") || riskLevel.includes("critical") ? 1 : 0;
      current.totalRisk += asNumber(item.risk_score, 0);
      current.averageRisk = current.total ? Math.round(current.totalRisk / current.total) : 0;
      current.passRate = current.total ? Math.round((current.passed / current.total) * 100) : 0;

      modelMap.set(model, current);
    });

    return Array.from(modelMap.values()).sort((a, b) => b.total - a.total);
  }, [resultItems]);

  const campaignDashboardSummary = useMemo(() => {
    const total = resultItems.length;
    const highCriticalInputs = resultItems.filter((item) =>
      legacyHighOrCritical(legacyInputRiskLevel(item))
    ).length;

    const blockedAttacks = resultItems.filter(
      (item) => legacyAttackSucceeded(item) === false
    ).length;

    const residualHighRisk = resultItems.filter((item) =>
      legacyHighOrCritical(legacyOutputRiskLevel(item))
    ).length;

    const averageResidualRisk =
      total === 0
        ? 0
        : Math.round(
            resultItems.reduce((sum, item) => {
              const record = legacyRecord(item);
              const report = legacyRecord(record.sandbox_report);
              const risk = legacyRecord(report.risk_assessment || record.risk_assessment);
              return sum + legacyNumber(risk.risk_score, 0);
            }, 0) / total
          );

    const inputDistribution: Record<string, number> = {};
    const finalDistribution: Record<string, number> = {};
    const categoryDistribution: Record<string, number> = {};
    const subcategoryDistribution: Record<string, number> = {};

    for (const item of resultItems) {
      const record = legacyRecord(item);
      const report = legacyRecord(record.sandbox_report);
      const inputRisk = legacyRecord(report.input_risk_metadata);
      const inputEvaluation = legacyRecord(report.input_evaluation);

      const inputLevel = legacyInputRiskLevel(item);
      const finalStatus = legacyFinalStatus(item);
      const category = legacyString(
        inputRisk.attack_category || inputEvaluation.attack_category || record.attack_category,
        "Unknown"
      );
      const subcategory = legacyString(
        inputRisk.subcategory || inputEvaluation.subcategory || record.subcategory,
        "Unspecified"
      );

      inputDistribution[inputLevel] = (inputDistribution[inputLevel] || 0) + 1;
      finalDistribution[finalStatus] = (finalDistribution[finalStatus] || 0) + 1;
      categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
      subcategoryDistribution[subcategory] = (subcategoryDistribution[subcategory] || 0) + 1;
    }

    return {
      total,
      highCriticalInputs,
      blockedAttacks,
      residualHighRisk,
      averageResidualRisk,
      inputDistribution,
      finalDistribution,
      categoryDistribution,
      subcategoryDistribution,
    };
  }, [resultItems]);

  const testedModelNames = useMemo(() => {
    const names = Array.from(
      new Set(
        resultItems
          .map((item) => {
            const record = legacyRecord(item);
            return legacyString(
              record.model_name || record.model || record.model_id || record.provider,
              ""
            ).trim();
          })
          .filter(Boolean)
      )
    );

    return names.length > 0 ? names : selectedModels;
  }, [resultItems, selectedModels]);

  const professionalFindings = useMemo(() => {
    return resultItems.map((item, index) => {
      const record = resultRecord(item);
      const decision = resultDecision(item);
      const model = resultModelName(item);
      const inputRisk = resultInputRiskLevel(item);
      const outputRisk = resultOutputRiskLevel(item);
      const status = resultFinalStatus(item);

      return {
        raw: item,
        index,
        resultId: resultText(record.id || record.result_id || record.test_id, `#${index + 1}`),
        title: resultText(record.attack_name || record.scenario_id || record.dataset_row_id, `Result #${index + 1}`),
        model,
        mutation: resultText(record.mutation_type || record.mutation, "direct"),
        inputRisk,
        inputScore: resultInputRiskScore(item),
        outputRisk,
        outputScore: resultRiskScore(item),
        status,
        decision,
        attackSuccess: resultAttackSuccess(item),
        category: resultCategory(item),
        subcategory: resultSubcategory(item),
        owasp: resultOwasp(item),
        metadataSource: resultMetadataSource(item),
        errorMessage: resultErrorMessage(item),
        prompt: resultPromptPreview(item),
        modelResponse: resultModelResponse(item),
        inputReason: resultInputReason(item),
        outputReason: resultOutputReason(item),
        confidence: resultConfidence(item),
      };
    });
  }, [resultItems]);

  const professionalResultsSummary = useMemo(() => {
    const inputDistribution: Record<string, number> = {};
    const outputDistribution: Record<string, number> = {};
    const finalDistribution: Record<string, number> = {};
    const categoryDistribution: Record<string, number> = {};
    const owaspDistribution: Record<string, number> = {};

    let blockedAttacks = 0;
    let successfulAttacks = 0;
    let executionErrors = 0;
    let needsReview = 0;
    let residualHighRisk = 0;
    let totalRisk = 0;
    let highestInputRisk = 0;
    let highestOutputRisk = 0;

    professionalFindings.forEach((item) => {
      const finalLabel =
        item.decision === "Passed"
          ? item.status.toLowerCase().includes("blocked")
            ? "Attack Blocked"
            : "Passed"
          : item.decision;

      inputDistribution[item.inputRisk] = (inputDistribution[item.inputRisk] || 0) + 1;
      outputDistribution[item.outputRisk] = (outputDistribution[item.outputRisk] || 0) + 1;
      finalDistribution[finalLabel] = (finalDistribution[finalLabel] || 0) + 1;
      categoryDistribution[item.category] = (categoryDistribution[item.category] || 0) + 1;
      owaspDistribution[item.owasp] = (owaspDistribution[item.owasp] || 0) + 1;

      if (resultHighCritical(item.outputRisk) || item.outputScore >= 70) residualHighRisk += 1;
      if (item.attackSuccess === true) successfulAttacks += 1;
      if (item.decision === "Execution Error") executionErrors += 1;
      if (item.decision === "Needs Review") needsReview += 1;

      if (item.decision === "Passed" || item.attackSuccess === false || item.status.toLowerCase().includes("blocked")) {
        blockedAttacks += 1;
      }

      totalRisk += item.outputScore;
      highestInputRisk = Math.max(highestInputRisk, item.inputScore);
      highestOutputRisk = Math.max(highestOutputRisk, item.outputScore);
    });

    const total = professionalFindings.length;
    const campaignCompleted = campaignStatus?.status === "completed";
    const reportReady = total > 0;

    const overallVerdict =
      total === 0
        ? "No Results"
        : executionErrors > 0
          ? "Completed with execution issues"
          : successfulAttacks > 0
            ? "Failed"
            : needsReview > 0 || residualHighRisk > 0
              ? "Passed with review notes"
              : "Passed";

    const recommendedAction =
      total === 0
        ? "Refresh results after campaign completion."
        : executionErrors > 0
          ? "Review provider/API errors before or during final reporting."
          : successfulAttacks > 0
            ? "Inspect failed attacks and create remediation actions."
            : needsReview > 0 || residualHighRisk > 0
              ? "Review flagged outputs before sending to Reports."
              : "Safe to send to Reports.";

    return {
      total,
      blockedAttacks,
      successfulAttacks,
      executionErrors,
      needsReview,
      residualHighRisk,
      averageResidualRisk: total ? Math.round(totalRisk / total) : 0,
      highestInputRisk,
      highestOutputRisk,
      inputDistribution,
      outputDistribution,
      finalDistribution,
      categoryDistribution,
      owaspDistribution,
      overallVerdict,
      recommendedAction,
      reportReady,
      readiness: [
        { label: "Campaign completed", ready: campaignCompleted },
        { label: "Results available", ready: total > 0 },
        { label: "Model comparison", ready: total > 0 },
        { label: "Detailed findings", ready: total > 0 },
        { label: "Errors reviewed", ready: executionErrors === 0 },
      ],
    };
  }, [campaignStatus?.status, professionalFindings]);

  const professionalModelComparison = useMemo(() => {
    const modelMap = new Map<
      string,
      {
        model: string;
        total: number;
        blocked: number;
        successfulAttacks: number;
        executionErrors: number;
        needsReview: number;
        residualHighRisk: number;
        totalRisk: number;
        averageRisk: number;
        blockRate: number;
        decision: string;
        results: typeof professionalFindings;
      }
    >();

    professionalFindings.forEach((item) => {
      const current =
        modelMap.get(item.model) ||
        {
          model: item.model,
          total: 0,
          blocked: 0,
          successfulAttacks: 0,
          executionErrors: 0,
          needsReview: 0,
          residualHighRisk: 0,
          totalRisk: 0,
          averageRisk: 0,
          blockRate: 0,
          decision: "Pending",
          results: [],
        };

      current.total += 1;
      current.results.push(item);
      current.totalRisk += item.outputScore;

      if (item.decision === "Passed" || item.attackSuccess === false || item.status.toLowerCase().includes("blocked")) current.blocked += 1;
      if (item.decision === "Failed" || item.attackSuccess === true) current.successfulAttacks += 1;
      if (item.decision === "Execution Error") current.executionErrors += 1;
      if (item.decision === "Needs Review") current.needsReview += 1;
      if (resultHighCritical(item.outputRisk) || item.outputScore >= 70) current.residualHighRisk += 1;

      current.averageRisk = current.total ? Math.round(current.totalRisk / current.total) : 0;
      current.blockRate = current.total ? Math.round((current.blocked / current.total) * 100) : 0;
      current.decision =
        current.executionErrors > 0
          ? "Execution Error"
          : current.successfulAttacks > 0
            ? "Failed"
            : current.needsReview > 0 || current.residualHighRisk > 0
              ? "Needs Review"
              : "Passed";

      modelMap.set(item.model, current);
    });

    return Array.from(modelMap.values()).sort((a, b) => {
      if (a.successfulAttacks !== b.successfulAttacks) return a.successfulAttacks - b.successfulAttacks;
      if (b.blockRate !== a.blockRate) return b.blockRate - a.blockRate;
      if (a.averageRisk !== b.averageRisk) return a.averageRisk - b.averageRisk;
      if (a.executionErrors !== b.executionErrors) return a.executionErrors - b.executionErrors;
      if (a.needsReview !== b.needsReview) return a.needsReview - b.needsReview;
      return a.model.localeCompare(b.model);
    });
  }, [professionalFindings]);

  const executiveModelInsights = useMemo(() => {
    const models = professionalModelComparison;

    const safestModel = models[0] || null;

    const vulnerableCandidates = models.filter(
      (model) =>
        model.successfulAttacks > 0 ||
        model.averageRisk > 0 ||
        model.residualHighRisk > 0 ||
        model.needsReview > 0 ||
        model.executionErrors > 0
    );

    const mostVulnerableModel =
      [...vulnerableCandidates].sort((a, b) => {
        if (b.successfulAttacks !== a.successfulAttacks) return b.successfulAttacks - a.successfulAttacks;
        if (b.averageRisk !== a.averageRisk) return b.averageRisk - a.averageRisk;
        if (b.residualHighRisk !== a.residualHighRisk) return b.residualHighRisk - a.residualHighRisk;
        if (b.needsReview !== a.needsReview) return b.needsReview - a.needsReview;
        if (b.executionErrors !== a.executionErrors) return b.executionErrors - a.executionErrors;
        return a.model.localeCompare(b.model);
      })[0] || null;

    const bestBlockRate =
      [...models].sort((a, b) => {
        if (b.blockRate !== a.blockRate) return b.blockRate - a.blockRate;
        if (a.averageRisk !== b.averageRisk) return a.averageRisk - b.averageRisk;
        return a.model.localeCompare(b.model);
      })[0] || null;

    const highestResidualRisk =
      [...models].sort((a, b) => {
        if (b.averageRisk !== a.averageRisk) return b.averageRisk - a.averageRisk;
        if (b.residualHighRisk !== a.residualHighRisk) return b.residualHighRisk - a.residualHighRisk;
        return a.model.localeCompare(b.model);
      })[0] || null;

    return {
      safestModel,
      mostVulnerableModel,
      bestBlockRate,
      highestResidualRisk,
      needsReview: professionalResultsSummary.needsReview,
      executionErrors: professionalResultsSummary.executionErrors,
    };
  }, [professionalModelComparison, professionalResultsSummary.executionErrors, professionalResultsSummary.needsReview]);

  const filteredProfessionalFindings = useMemo(() => {
    const search = findingSearch.trim().toLowerCase();

    return professionalFindings.filter((item) => {
      const matchesSearch =
        !search ||
        [
          item.resultId,
          item.title,
          item.model,
          item.status,
          item.decision,
          item.inputRisk,
          item.outputRisk,
          item.category,
          item.owasp,
          item.prompt,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);

      const matchesModel = findingModelFilter === "All" || item.model === findingModelFilter;
      const matchesStatus = findingStatusFilter === "All" || item.decision === findingStatusFilter;
      const matchesRisk = findingRiskFilter === "All" || item.inputRisk === findingRiskFilter || item.outputRisk === findingRiskFilter;

      return matchesSearch && matchesModel && matchesStatus && matchesRisk;
    });
  }, [findingModelFilter, findingRiskFilter, findingSearch, findingStatusFilter, professionalFindings]);

  const estimatedTests = useMemo(() => {
    const inputCount = selectedDataset?.row_count || selectedScenarioIds.length || 0;
    const cappedInputCount = Math.min(Math.max(inputCount, 0), Math.max(Number(maxTests) || 0, 0));

    return (
      Math.max(cappedInputCount, 0) *
      Math.max(selectedModels.length, 1) *
      Math.max(mutationList.length, 1)
    );
  }, [maxTests, mutationList.length, selectedDataset?.row_count, selectedModels.length, selectedScenarioIds.length]);

  const filteredRecentCampaigns = useMemo(() => {
    return recentCampaigns.filter((campaign) => {
      const searchText = [
        campaign.name,
        campaign.campaign_id,
        campaign.dataset_name,
        campaign.status,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !recentSearch.trim() || searchText.includes(recentSearch.trim().toLowerCase());

      const status = campaign.status || "Unknown";
      const matchesStatus = recentStatusFilter === "All" || status === recentStatusFilter;

      const source = campaign.dataset_name ? "Dataset" : "Library assets";
      const matchesSource = recentSourceFilter === "All" || source === recentSourceFilter;

      const riskScore = Number(campaign.average_risk_score || 0);
      const riskBucket = riskScore >= 70 ? "High" : riskScore >= 35 ? "Medium" : "Low";
      const matchesRisk = recentRiskFilter === "All" || riskBucket === recentRiskFilter;

      return matchesSearch && matchesStatus && matchesSource && matchesRisk;
    });
  }, [recentCampaigns, recentRiskFilter, recentSearch, recentSourceFilter, recentStatusFilter]);

  const campaignRunning = campaignStatus?.status === "queued" || campaignStatus?.status === "running";
  const campaignCompleted = campaignStatus?.status === "completed";
  const datasetReady = Boolean(selectedDatasetId);
  const inputsReady = datasetReady || selectedScenarioIds.length > 0;
  const modelsReady = selectedModels.length > 0;
  const configurationReady = Boolean(campaignName.trim()) && modelsReady && inputsReady && Number(maxTests) > 0;

  const loadLibraryAssets = useCallback(async () => {
    setLoadingMessage("Loading Library assets...");
    setErrorMessage("");

    try {
      const [datasetResult, scenarioResult] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/datasets`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/scenarios`, { cache: "no-store" }),
      ]);

      if (datasetResult.status === "fulfilled" && datasetResult.value.ok) {
        const datasetData = await datasetResult.value.json();
        setDatasets(normalizeArray<Dataset>(datasetData));
      }

      if (scenarioResult.status === "fulfilled" && scenarioResult.value.ok) {
        const scenarioData = await scenarioResult.value.json();
        setScenarios(normalizeArray<Scenario>(scenarioData));
      }

      setNotice("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load Library assets.");
    } finally {
      setLoadingMessage("");
    }
  }, []);

  const loadModels = useCallback(async () => {
    setLoadingMessage("Loading model options...");
    setErrorMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/model-providers`, { cache: "no-store" });

      if (!response.ok) {
        setNotice("Using default campaign model options.");
        return;
      }

      const data = await response.json();
      const providerItems = normalizeArray<Record<string, unknown>>(data);

      const loadedModels = providerItems
        .map((item) => {
          const provider = asString(item.provider || item.provider_name || item.type, "Provider");
          const model = asString(item.model || item.model_name || item.name || item.id, "");

          if (!model) return null;

          return {
            value: `${provider.toLowerCase()}:${model}`,
            label: model,
            provider,
            description: "Configured model provider option.",
            available_for_campaigns: true,
          } satisfies ModelOption;
        })
        .filter(Boolean) as ModelOption[];

      if (loadedModels.length > 0) {
        setModelOptions(loadedModels);
        setNotice(`Loaded ${loadedModels.length} configured model option(s).`);
      } else {
        setNotice("Using default campaign model options.");
      }
    } catch {
      setNotice("Using default campaign model options.");
    } finally {
      setLoadingMessage("");
    }
  }, []);

  useEffect(() => {
    loadBackendRecentCampaigns().catch(() => {
      setRecentCampaigns(loadRecentCampaigns());
    });
    loadLibraryAssets();
    loadModels();
  }, [loadLibraryAssets, loadModels]);

  function toggleScenario(scenarioId: string) {
    setSelectedScenarioIds((previous) =>
      previous.includes(scenarioId)
        ? previous.filter((item) => item !== scenarioId)
        : [...previous, scenarioId]
    );
  }

  function toggleModel(modelValue: string) {
    setSelectedModels((previous) =>
      previous.includes(modelValue)
        ? previous.filter((item) => item !== modelValue)
        : [...previous, modelValue]
    );
  }

  function addCustomModel() {
    const cleanValue = customModel.trim();

    if (!cleanValue) return;

    if (!selectedModels.includes(cleanValue)) {
      setSelectedModels((previous) => [...previous, cleanValue]);
    }

    if (!modelOptions.some((model) => model.value === cleanValue)) {
      setModelOptions((previous) => [
        ...previous,
        {
          value: cleanValue,
          label: cleanValue,
          provider: "Custom",
          description: "Custom backend-ready model identifier.",
          available_for_campaigns: true,
        },
      ]);
    }

    setCustomModel("");
  }

  async function handleCreateCampaign() {
    setLoadingMessage("Creating campaign...");
    setErrorMessage("");
    setNotice("");

    try {
      const payload = {
        name: campaignName.trim(),
        description: "Automated campaign created from the Campaigns wizard.",
        test_source_type: selectedDatasetId ? "uploaded_dataset" : "scenario_library",
        dataset_id: selectedDatasetId || null,
        selected_models: selectedModels,
        selected_scenario_ids: selectedScenarioIds,
        selected_categories: selectedScenarios
          .map((scenario) => scenario.attack_category)
          .filter(Boolean),
        selected_mutations: mutationList.length ? mutationList : ["direct"],
        max_tests: Math.max(1, Number(maxTests) || 1),
      };

      const response = await fetch(`${API_BASE_URL}/campaigns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const created = await parseApiResponse<CampaignStatus>(response);
      const newCampaignId = created.campaign_id;

      setCampaignId(newCampaignId);
      setCampaignStatus(created);
      setCampaignResults(null);
      setNotice("Campaign created successfully.");

      const nextRecent = [
        {
          campaign_id: newCampaignId,
          name: created.name || campaignName,
          status: created.status,
          dataset_name: created.dataset_name || selectedDataset?.name || null,
          total_tests: created.total_tests || 0,
          completed_tests: created.completed_tests || 0,
          failed_tests: created.failed_tests || 0,
          average_risk_score: created.average_risk_score || 0,
          critical_findings: created.critical_findings || 0,
          updated_at: new Date().toISOString(),
        },
        ...recentCampaigns.filter((item) => item.campaign_id !== newCampaignId),
      ].slice(0, 12);

      setRecentCampaigns(nextRecent);
      saveRecentCampaigns(nextRecent);
      setActiveWizardStep(4);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create campaign.");
    } finally {
      setLoadingMessage("");
    }
  }

  async function loadCampaignStatusAndResults(targetCampaignId = campaignId) {
    const cleanCampaignId = targetCampaignId.trim();

    if (!cleanCampaignId) return;

    setLoadingMessage("Loading campaign status...");
    setErrorMessage("");

    try {
      const statusResponse = await fetch(`${API_BASE_URL}/campaigns/${cleanCampaignId}/status`, {
        cache: "no-store",
      });
      const status = await parseApiResponse<CampaignStatus>(statusResponse);

      setCampaignId(cleanCampaignId);
      setCampaignStatus(status);

      const resultsResponse = await fetch(`${API_BASE_URL}/campaigns/${cleanCampaignId}/results`, {
        cache: "no-store",
      });

      if (resultsResponse.ok) {
        const results = await parseApiResponse<CampaignResultsResponse>(resultsResponse);
        setCampaignResults(results);
      }

      setNotice("Campaign status refreshed.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load campaign status.");
    } finally {
      setLoadingMessage("");
    }
  }

  useEffect(() => {
    const cleanCampaignId = campaignId.trim();
    const status = campaignStatus?.status?.toLowerCase();

    if (!cleanCampaignId || (status !== "queued" && status !== "running")) return;

    let cancelled = false;

    const refreshCurrentCampaign = async () => {
      try {
        const statusResponse = await fetch(`${API_BASE_URL}/campaigns/${cleanCampaignId}/status`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!statusResponse.ok || cancelled) return;

        const statusData = await parseApiResponse<CampaignStatus>(statusResponse);
        setCampaignStatus(statusData);

        const resultsResponse = await fetch(`${API_BASE_URL}/campaigns/${cleanCampaignId}/results`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (resultsResponse.ok && !cancelled) {
          const resultsData = await parseApiResponse<CampaignResultsResponse>(resultsResponse);
          setCampaignResults(resultsData);
        }
      } catch {
        return;
      }
    };

    void refreshCurrentCampaign();

    const connectedCampaignPoll = window.setInterval(() => {
      void refreshCurrentCampaign();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(connectedCampaignPoll);
    };
  }, [campaignId, campaignStatus?.status]);

  async function handleRunCampaign() {
    const cleanCampaignId = campaignId.trim();

    if (!cleanCampaignId || campaignRunning || campaignCompleted) return;

    setLoadingMessage("Starting campaign run...");
    setErrorMessage("");
    setNotice("");

    setCampaignStatus((previous) =>
      previous
        ? {
            ...previous,
            status: "running",
            progress_percent: previous.progress_percent || 0,
          }
        : previous
    );

    try {
      const response = await fetch(`${API_BASE_URL}/campaigns/${cleanCampaignId}/run`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      await parseApiResponse(response);
      setNotice("Campaign run started.");

      window.setTimeout(() => {
        void loadCampaignStatusAndResults(cleanCampaignId);
      }, 800);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to run campaign.");
    } finally {
      setLoadingMessage("");
    }
  }

  useEffect(() => {
    const cleanCampaignId = campaignId.trim();
    const status = campaignStatus?.status?.toLowerCase();

    if (!cleanCampaignId || (status !== "queued" && status !== "running")) return;

    let cancelled = false;

    const pollCampaignStatus = async () => {
      if (cancelled) return;

      try {
        const statusResponse = await fetch(`${API_BASE_URL}/campaigns/${cleanCampaignId}/status`, {
          cache: "no-store",
        });

        if (!statusResponse.ok) return;

        const statusData = await parseApiResponse<CampaignStatus>(statusResponse);

        if (cancelled) return;

        setCampaignStatus(statusData);

        const resultsResponse = await fetch(`${API_BASE_URL}/campaigns/${cleanCampaignId}/results`, {
          cache: "no-store",
        });

        if (resultsResponse.ok) {
          const resultsData = await parseApiResponse<CampaignResultsResponse>(resultsResponse);

          if (!cancelled) {
            setCampaignResults(resultsData);
          }
        }
      } catch {
        // Keep the current visible status and allow the next poll to try again.
      }
    };

    void pollCampaignStatus();

    const timer = window.setInterval(() => {
      void pollCampaignStatus();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [campaignId, campaignStatus?.status]);

async function handleOpenRecentCampaign(targetCampaignId: string) {
    const cleanCampaignId = targetCampaignId.trim();

    if (!cleanCampaignId) {
      setErrorMessage("Campaign ID is missing.");
      return;
    }

    setCampaignId(cleanCampaignId);
    setErrorMessage("");
    setSelectedFinding(null);

    // Open the Results Dashboard directly on Model Reports.
    setResultsDashboardTab("reports");
    setResultsDashboardOpen(true);

    setNotice(`Loading model summary for ${cleanCampaignId}...`);

    try {
      await loadCampaignStatusAndResults(cleanCampaignId);

      if (typeof loadBackendRecentCampaigns === "function") {
        await loadBackendRecentCampaigns();
      }

      setNotice(`Model summary loaded for ${cleanCampaignId}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load model summary for this campaign."
      );
    }
  }

  function handleSendRecentCampaignToReports(targetCampaignId: string) {
    const cleanCampaignId = targetCampaignId.trim();

    if (!cleanCampaignId) {
      setErrorMessage("Campaign ID is missing.");
      return;
    }

    window.location.href = `/reports?campaignId=${encodeURIComponent(cleanCampaignId)}`;
  }

  function handleClearRecentCampaigns() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RECENT_CAMPAIGNS_STORAGE_KEY);
    }

    loadBackendRecentCampaigns().catch(() => {
      setRecentCampaigns([]);
    });

    setNotice("Local campaign cache cleared. Backend campaign history reloaded.");
  }


  useEffect(() => {
    if (!resultsDashboardOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [resultsDashboardOpen]);


  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(""), 4000);

    return () => window.clearTimeout(timer);
  }, [notice]);


  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(""), 4000);

    return () => window.clearTimeout(timer);
  }, [notice]);


  return (
    <div className="hxg-background min-h-screen px-4 py-6 text-white sm:px-6 xl:px-8">
      <div className="mx-auto w-full max-w-[1280px] space-y-6">
        <section className="relative overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#1f2122]/95 px-6 py-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.24)] md:px-8 md:py-12">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 8% 18%, rgba(255, 52, 52, 0.12), transparent 38%), radial-gradient(circle at 88% 18%, rgba(255, 52, 52, 0.08), transparent 38%), radial-gradient(circle at 58% 14%, rgba(74, 215, 255, 0.08), transparent 36%), linear-gradient(135deg, rgba(18,20,21,0.99), rgba(31,33,34,0.98) 52%, rgba(39,41,42,0.96))",
            }}
          />

          <div
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              backgroundPosition: "center",
            }}
          />

          <div className="relative z-10 mx-auto max-w-5xl">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
              Automated Campaigns
            </p>

            <h1 className="mt-3 text-4xl font-black uppercase tracking-[-0.05em] text-white md:text-5xl">
              Automated Red Teaming
              <br />
              <span className="text-[#ff3434]">Campaigns</span>
            </h1>

            <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-[#d4d4d4] sm:text-base">
              Run batch red-team evaluations using saved Library assets and configured target models.
              Campaigns execute tests; Library manages assets; Reports handles final analysis and export.
            </p>

          </div>
        </section>

        {((notice && notice !== "Library assets loaded.") || errorMessage || loadingMessage) && (
          <section className="rounded-[18px] border border-white/[0.06] bg-[#1f2122]/95 p-4">
            {loadingMessage && <p className="text-sm font-bold text-[#4ad7ff]">{loadingMessage}</p>}
            {notice && notice !== "Library assets loaded." && <p className="text-sm font-bold text-[#30d158]">{notice}</p>}
            {errorMessage && <p className="text-sm font-bold text-[#ff3434]">{errorMessage}</p>}
          </section>
        )}

        <section className="rounded-[24px] border border-white/[0.06] bg-[#1f2122]/95 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.25)] md:p-6">
          <div className="mb-5 flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-[#ff3434]">
                Step {activeWizardStep} of 5
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                {activeWizardStep === 1 && "Select Inputs"}
                {activeWizardStep === 2 && "Select Models"}
                {activeWizardStep === 3 && "Configure Campaign"}
                {activeWizardStep === 4 && "Run Campaign"}
                {activeWizardStep === 5 && "Results"}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {[
                { id: 1, label: "Inputs" },
                { id: 2, label: "Models" },
                { id: 3, label: "Configure" },
                { id: 4, label: "Run" },
                { id: 5, label: "Results" },
              ].map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveWizardStep(step.id as WizardStep)}
                  className={
                    activeWizardStep === step.id
                      ? "rounded-full bg-[#ff3434] px-4 py-2 text-xs font-black text-white whitespace-nowrap"
                      : "rounded-full border border-white/[0.08] bg-[#27292a] px-4 py-2 text-xs font-black text-[#a9a9a9] transition hover:text-white whitespace-nowrap"
                  }
                >
                  {step.label}
                </button>
              ))}
            </div>
          </div>

          {activeWizardStep === 1 && (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[16px] border border-white/[0.05] bg-[#27292a] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-white">Prompt Datasets from Library</h3>
                      <span className="rounded-full border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-3 py-1 text-[11px] font-black text-[#4ad7ff]">
                        {selectedDataset ? "1 selected" : "0 selected"}
                      </span>
                    </div>

                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <SoftButton onClick={() => { window.location.href = "/datasets"; }}>
                      Open Dataset Library
                    </SoftButton>
                  </div>
                </div>

                <div className="mt-4 max-h-[245px] overflow-y-auto overflow-x-hidden rounded-[16px] border border-white/[0.05]">
                  <table className="w-full table-fixed border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#1f2122]">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">Select</th>
                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">Dataset</th>
                        <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">Rows</th>
                        <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datasets.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#727272]">
                            No saved datasets loaded. Refresh the Library list or open Prompt Dataset Library.
                          </td>
                        </tr>
                      ) : (
                        datasets.slice(0, 12).map((dataset) => {
                          const selected = selectedDatasetId === dataset.dataset_id;

                          return (
                            <tr
                              key={dataset.dataset_id}
                              onClick={() => {
                            setSelectedDatasetId(selected ? "" : dataset.dataset_id);
                          }}
                              className={`cursor-pointer border-t border-white/[0.05] transition ${selected ? "border-l-2 border-l-[#ff3434] bg-[#ff3434]/5" : "border-l-2 border-l-transparent hover:bg-white/[0.025]"}`}
                            >
                              <td className="px-3 py-2 max-w-0">
                                <span className={`grid h-4 w-4 place-items-center rounded-full border ${selected ? "border-[#ff3434] bg-[#ff3434]" : "border-white/[0.18]"}`}>
                                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                </span>
                              </td>
                              <td className="px-3 py-2 max-w-0">
                                <p className="truncate font-semibold text-white" title={dataset.name}>{dataset.name}</p>
                                <p className="mt-1 font-mono text-xs text-[#4ad7ff]">{dataset.dataset_id}</p>
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-xs text-[#d4d4d4]">{dataset.row_count || 0}</td>
                              <td className="px-3 py-2 text-right">
                                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-[#30d158]">
                                  {dataset.validation_status || "Ready"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-[16px] border border-white/[0.05] bg-[#27292a] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-white">Attack Scenarios from Library</h3>
                      <span className="rounded-full border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-3 py-1 text-[11px] font-black text-[#4ad7ff]">
                        {selectedScenarioIds.length} selected
                      </span>
                    </div>

                  </div>

                  <SoftButton onClick={() => { window.location.href = "/scenarios"; }}>
                    Open Scenario Library
                  </SoftButton>
                </div>

                <div className="mt-4 max-h-[245px] overflow-y-auto overflow-x-hidden rounded-[16px] border border-white/[0.05]">
                  <table className="w-full table-fixed border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#1f2122]">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">Select</th>
                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">Scenario</th>
                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">Category</th>
                        <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#727272]">
                            No scenarios loaded. Refresh assets or open Scenario Library.
                          </td>
                        </tr>
                      ) : (
                        scenarios.slice(0, 12).map((scenario) => {
                          const selected = selectedScenarioIds.includes(scenario.scenario_id);

                          return (
                            <tr
                              key={scenario.scenario_id}
                              onClick={() => toggleScenario(scenario.scenario_id)}
                              className={`cursor-pointer border-t border-white/[0.05] transition ${selected ? "border-l-2 border-l-[#ff3434] bg-[#ff3434]/5" : "border-l-2 border-l-transparent hover:bg-white/[0.025]"}`}
                            >
                              <td className="px-3 py-2 max-w-0">
                                <span className={`grid h-4 w-4 place-items-center rounded-[4px] border ${selected ? "border-[#ff3434] bg-[#ff3434]" : "border-white/[0.18]"}`}>
                                  {selected && <span className="h-2 w-2 rounded-[2px] bg-white" />}
                                </span>
                              </td>
                              <td className="px-3 py-2 max-w-0">
                                <p className="truncate font-semibold text-white" title={scenario.attack_name}>{scenario.attack_name}</p>
                                <p className="mt-1 font-mono text-xs text-[#4ad7ff]">{scenario.scenario_id}</p>
                              </td>
                              <td className="px-3 py-2 text-xs text-[#d4d4d4]">{scenario.attack_category || "General"}</td>
                              <td className="px-3 py-2 text-right">
                                <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${riskBadgeClass(scenario.severity)}`}>
                                  {scenario.severity || "Medium"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeWizardStep === 2 && (
            <div className="rounded-[20px] border border-white/[0.05] bg-[#27292a] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <SoftButton onClick={() => { window.location.href = "/settings/models"; }}>
                    Manage Models
                  </SoftButton>
                  <Pill tone="cyan">{selectedModels.length} Selected</Pill>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {modelOptions.map((model) => {
                  const selected = selectedModels.includes(model.value);

                  return (
                    <button
                      key={model.value}
                      type="button"
                      onClick={() => toggleModel(model.value)}
                      className={`flex min-h-[132px] flex-col justify-between rounded-[20px] border p-4 text-left transition hover:-translate-y-1 ${
                        selected
                          ? "border-red-400/60 bg-[#ff3434]/15"
                          : "border-white/[0.05] bg-[#1f2122] hover:border-[#ff3434]/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-black text-white">{model.label}</h4>
                          <p className="mt-1 text-xs font-black text-[#4ad7ff]">{model.provider}</p>
                        </div>
                        <Pill tone={selected ? "red" : "cyan"}>
                          {selected ? "Selected" : "Available"}
                        </Pill>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-[#a9a9a9]">{model.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeWizardStep === 3 && (
            <div className="space-y-4">
              <div className="rounded-[16px] border border-white/[0.05] bg-[#27292a] p-4">
                <div className="grid gap-3 lg:grid-cols-3">
                  <Field label="Campaign Name">
                    <TextInput value={campaignName} onChange={setCampaignName} />
                  </Field>

                  <Field label="Mutation Strategy">
                    <TextInput value={mutations} onChange={setMutations} />
                  </Field>

                  <Field label="Maximum Tests">
                    <TextInput value={maxTests} onChange={setMaxTests} />
                  </Field>
                </div>
              </div>

              <div className="rounded-[18px] border border-white/[0.05] bg-[#27292a] p-4">
                <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${inputsReady ? "border-[#30d158]/25 bg-[#30d158]/10 text-[#30d158]" : "border-[#ffb020]/25 bg-[#ffb020]/10 text-[#ffb020]"}`}>
                    Inputs: {inputsReady ? "Ready" : "Missing"}
                  </span>

                  <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${selectedModels.length > 0 ? "border-[#30d158]/25 bg-[#30d158]/10 text-[#30d158]" : "border-[#ffb020]/25 bg-[#ffb020]/10 text-[#ffb020]"}`}>
                    Models: {selectedModels.length > 0 ? "Ready" : "Missing"}
                  </span>

                  <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${mutationList.length > 0 ? "border-[#30d158]/25 bg-[#30d158]/10 text-[#30d158]" : "border-[#ffb020]/25 bg-[#ffb020]/10 text-[#ffb020]"}`}>
                    Mutations: {mutationList.length > 0 ? "Ready" : "Missing"}
                  </span>

                  <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${Number(maxTests) > 0 ? "border-[#30d158]/25 bg-[#30d158]/10 text-[#30d158]" : "border-[#ffb020]/25 bg-[#ffb020]/10 text-[#ffb020]"}`}>
                    Limit: {Number(maxTests) > 0 ? "Ready" : "Missing"}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  <div className="flex min-h-[84px] flex-col items-center justify-center rounded-[15px] bg-[#1b1e1f] px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_8px_18px_rgba(0,0,0,0.14)]">
                    <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#a9a9a9]">
                      Selected Dataset
                    </p>
                    <p className={`mt-2 max-w-full truncate font-mono text-base font-black ${selectedDataset ? "text-[#30d158]" : "text-[#ffb020]"}`}>
                      {selectedDataset?.name || "None"}
                    </p>
                  </div>

                  <div className="flex min-h-[84px] flex-col items-center justify-center rounded-[15px] bg-[#1b1e1f] px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_8px_18px_rgba(0,0,0,0.14)]">
                    <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#a9a9a9]">
                      Selected Scenarios
                    </p>
                    <p className={`mt-2 font-mono text-2xl font-black ${selectedScenarioIds.length > 0 ? "text-[#30d158]" : "text-[#ffb020]"}`}>
                      {selectedScenarioIds.length}
                    </p>
                  </div>

                  <div className="flex min-h-[84px] flex-col items-center justify-center rounded-[15px] bg-[#1b1e1f] px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_8px_18px_rgba(0,0,0,0.14)]">
                    <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#a9a9a9]">
                      Input Items
                    </p>
                    <p className="mt-2 font-mono text-2xl font-black text-[#4ad7ff]">
                      {(selectedDataset?.row_count || 0) + selectedScenarioIds.length}
                    </p>
                  </div>

                  <div className="flex min-h-[84px] flex-col items-center justify-center rounded-[15px] bg-[#1b1e1f] px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_8px_18px_rgba(0,0,0,0.14)]">
                    <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#a9a9a9]">
                      Selected Models
                    </p>
                    <p className={`mt-2 font-mono text-2xl font-black ${selectedModels.length > 0 ? "text-[#30d158]" : "text-[#ffb020]"}`}>
                      {selectedModels.length}
                    </p>
                  </div>

                  <div className="flex min-h-[84px] flex-col items-center justify-center rounded-[15px] bg-[#1b1e1f] px-3 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_8px_18px_rgba(0,0,0,0.14)]">
                    <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#a9a9a9]">
                      Estimated Total Tests
                    </p>
                    <p className="mt-2 font-mono text-2xl font-black text-[#4ad7ff]">
                      {estimatedTests}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeWizardStep === 4 && (
            <div className="space-y-5">
              {!campaignId ? (
                <div className="rounded-[20px] border border-dashed border-[#353637] bg-[#27292a] p-8 text-center">
                  <h3 className="text-xl font-black text-white">Campaign not created yet.</h3>
                  <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#727272]">
                    Complete Step 3 and create the campaign before running it.
                  </p>
                  <div className="mt-5">
                    <SoftButton onClick={() => setActiveWizardStep(3)}>
                      Back to Configure
                    </SoftButton>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-[18px] border border-white/[0.05] bg-[#27292a] p-4">
                    <div className="rounded-[14px] border border-white/[0.06] bg-[#151718] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                        Campaign ID
                      </p>
                      <p className="mt-2 max-w-full break-all font-mono text-lg font-black text-[#4ad7ff] md:text-xl">
                        {campaignId}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 md:flex-row">
                      <PrimaryButton onClick={handleRunCampaign} disabled={!campaignId.trim() || Boolean(loadingMessage) || campaignRunning || campaignCompleted}>
                        {campaignRunning ? "Running..." : campaignCompleted ? "Completed" : "Run Campaign"}
                      </PrimaryButton>

                      <SoftButton onClick={() => loadCampaignStatusAndResults()} disabled={!campaignId.trim() || Boolean(loadingMessage)}>
                        Refresh Status
                      </SoftButton>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <MetricCard label="Status" value={formatStatus(campaignStatus?.status || "Waiting")} tone={campaignCompleted ? "green" : campaignRunning ? "orange" : "cyan"} />
                    <MetricCard label="Progress" value={campaignStatus ? `${campaignStatus.progress_percent || 0}%` : "0%"} tone="cyan" />
                    <MetricCard label="Completed" value={`${campaignStatus?.completed_tests || 0}/${campaignStatus?.total_tests || 0}`} tone="green" />
                    <MetricCard label="Failed" value={String(campaignStatus?.failed_tests || 0)} tone={(campaignStatus?.failed_tests || 0) > 0 ? "red" : "green"} />
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-[#353637]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        campaignStatus?.status === "completed"
                          ? "bg-[#30d158]"
                          : campaignStatus?.status === "failed"
                            ? "bg-[#ff3434]"
                            : campaignRunning
                              ? "bg-[#4ad7ff]"
                              : "bg-[#727272]"
                      }`}
                      style={{
                        width: `${Math.min(Math.max(campaignStatus?.progress_percent || 0, 0), 100)}%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {activeWizardStep === 5 && (
            <div className="space-y-5">
              <section className="mx-auto max-w-[900px] rounded-[22px] border border-white/[0.06] bg-[#27292a]/95 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div>
                    <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-[#4ad7ff]">
                      Results
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-white">
                      Current Campaign Results
                    </h3>
                  </div>

                  <div className="mx-auto grid w-full max-w-[500px] grid-cols-2 gap-2">
                    <MetricCard label="Campaign ID" value={campaignId || campaignResults?.campaign_id || "Not loaded"} tone="cyan" />
                    <MetricCard label="Verdict" value={professionalResultsSummary.overallVerdict} tone={professionalResultsSummary.successfulAttacks > 0 ? "red" : professionalResultsSummary.executionErrors > 0 ? "orange" : "green"} />
                    <MetricCard label="Results Loaded" value={String(professionalResultsSummary.total)} tone="green" />
                    <MetricCard label="Models Tested" value={String(professionalModelComparison.length)} tone="cyan" />
                  </div>
                </div>

                <div className="mx-auto mt-4 grid w-full max-w-[680px] grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <MetricCard label="Total" value={String(campaignStatus?.total_tests || professionalResultsSummary.total)} />
                  <MetricCard label="Blocked" value={String(professionalResultsSummary.blockedAttacks)} tone="green" />
                  <MetricCard label="Successful Attacks" value={String(professionalResultsSummary.successfulAttacks)} tone={professionalResultsSummary.successfulAttacks > 0 ? "red" : "green"} />
                  <MetricCard label="Needs Review" value={String(professionalResultsSummary.needsReview)} tone={professionalResultsSummary.needsReview > 0 ? "orange" : "green"} />
                  <MetricCard label="Errors" value={String(professionalResultsSummary.executionErrors)} tone={professionalResultsSummary.executionErrors > 0 ? "orange" : "green"} />
                  <MetricCard label="Avg Output Risk" value={String(professionalResultsSummary.averageResidualRisk)} tone="cyan" />
                </div>

                <div className="mt-4 flex items-center justify-center gap-3">
                  {notice?.toLowerCase().includes("refresh") ? (
                    <span className="rounded-full border border-[#30d158]/20 bg-[#30d158]/10 px-3 py-2 text-xs font-black text-[#30d158]">
                      Last refreshed just now
                    </span>
                  ) : null}

                  <SoftButton
                    onClick={() => campaignId.trim() && loadCampaignStatusAndResults(campaignId.trim())}
                    disabled={!campaignId.trim() || Boolean(loadingMessage)}
                  >
                    Refresh Results
                  </SoftButton>
                </div>
              </section>
            </div>
          )}
















                    <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <SoftButton
              onClick={() =>
                setActiveWizardStep((step) => Math.max(1, step - 1) as WizardStep)
              }
              disabled={activeWizardStep === 1}
            >
              Back
            </SoftButton>

            {activeWizardStep < 5 ? (
              <PrimaryButton
                onClick={async () => {
                  if (activeWizardStep === 3) {
                    await handleCreateCampaign();
                    return;
                  }

                  if (activeWizardStep === 4) {
                    await loadCampaignStatusAndResults(campaignId.trim());
                    setActiveWizardStep(5);
                    setResultsDashboardTab("overview");
                      setResultsDashboardOpen(true);
                    return;
                  }

                  setActiveWizardStep((step) => Math.min(5, step + 1) as WizardStep);
                }}
                disabled={
                  (activeWizardStep === 1 && !inputsReady) ||
                  (activeWizardStep === 2 && selectedModels.length === 0) ||
                  (activeWizardStep === 3 && (!configurationReady || Boolean(loadingMessage))) ||
                  (activeWizardStep === 4 && !campaignCompleted)
                }
              >
                {activeWizardStep === 1 && "Next: Select Models"}
                {activeWizardStep === 2 && "Next: Configure Campaign"}
                {activeWizardStep === 3 && "Create Campaign & Continue"}
                {activeWizardStep === 4 && "View Results"}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onClick={async () => {
                  if (campaignId.trim()) {
                    await loadCampaignStatusAndResults(campaignId.trim());
                  }
                  setResultsDashboardTab("overview");
                      setResultsDashboardOpen(true);
                }}
                disabled={!campaignId.trim() || Boolean(loadingMessage)}
              >
                Open Results Dashboard
              </PrimaryButton>
            )}
          </div>
        </section>

        {/* Campaign Results Fullscreen Modal */}
        {resultsDashboardOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="flex max-h-[82vh] w-[86vw] max-w-[1120px] flex-col overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#232526] shadow-[0_24px_90px_rgba(0,0,0,0.58)]">
              <div className="border-b border-white/[0.06] bg-[#1f2122]/95 px-5 py-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-[#4ad7ff]">
                      Current Campaign Results
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">
                      Results Dashboard
                    </h2>
                  </div>

                  <span className="w-fit rounded-full border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-4 py-2 font-mono text-xs font-black text-[#4ad7ff]">
                    {campaignId || campaignResults?.campaign_id || "No campaign"}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    { key: "overview", label: "Overview" },
                    { key: "models", label: "Model Comparison" },
                    { key: "reports", label: "Model Reports" },
                    { key: "findings", label: "Detailed Findings" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setResultsDashboardTab(tab.key as "overview" | "models" | "reports" | "findings")}
                      className={`rounded-full border px-4 py-2 text-xs font-black transition ${
                        resultsDashboardTab === tab.key
                          ? "border-[#ff3434]/50 bg-[#ff3434] text-white shadow-[0_12px_30px_rgba(255,52,52,0.25)]"
                          : "border-white/[0.08] bg-[#27292a] text-[#a9a9a9] hover:border-[#4ad7ff]/35 hover:text-[#4ad7ff]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-6">
                {resultItems.length > 0 ? (
                  <>
                    {resultsDashboardTab === "overview" && (
                      <section className="space-y-5">
                        <div className="rounded-[22px] border border-white/[0.05] bg-[#27292a]/95 p-5">
                          <p className="text-center font-mono text-xs font-black uppercase tracking-[0.24em] text-[#4ad7ff]">
                            Executive Model Comparison
                          </p>

                          <div className="mx-auto mt-4 grid w-full max-w-[940px] gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                            <OverviewStatCard
                              label="Safest Model"
                              value={executiveModelInsights.safestModel?.model || "Not available"}
                              helper={
                                executiveModelInsights.safestModel
                                  ? `${executiveModelInsights.safestModel.successfulAttacks} attacks / ${executiveModelInsights.safestModel.blockRate}% blocked`
                                  : "No results"
                              }
                              tone="green"
                            />

                            <OverviewStatCard
                              label="Most Vulnerable"
                              value={executiveModelInsights.mostVulnerableModel?.model || "None detected"}
                              helper={
                                executiveModelInsights.mostVulnerableModel
                                  ? `${executiveModelInsights.mostVulnerableModel.successfulAttacks} successful / risk ${executiveModelInsights.mostVulnerableModel.averageRisk}`
                                  : "All models passed"
                              }
                              tone={executiveModelInsights.mostVulnerableModel ? "red" : "green"}
                            />

                            <OverviewStatCard
                              label="Best Block Rate"
                              value={executiveModelInsights.bestBlockRate ? `${executiveModelInsights.bestBlockRate.blockRate}%` : "N/A"}
                              tone="green"
                            />

                            <OverviewStatCard
                              label="Highest Residual Risk"
                              value={executiveModelInsights.highestResidualRisk ? String(executiveModelInsights.highestResidualRisk.averageRisk) : "N/A"}
                              tone={executiveModelInsights.highestResidualRisk && executiveModelInsights.highestResidualRisk.averageRisk > 0 ? "orange" : "green"}
                            />

                            <OverviewStatCard
                              label="Needs Review"
                              value={String(executiveModelInsights.needsReview)}
                              tone={executiveModelInsights.needsReview > 0 ? "orange" : "green"}
                            />

                            <OverviewStatCard
                              label="Execution Errors"
                              value={String(executiveModelInsights.executionErrors)}
                              tone={executiveModelInsights.executionErrors > 0 ? "orange" : "green"}
                            />
                          </div>
                        </div>

                        <div className="rounded-[22px] border border-white/[0.05] bg-[#27292a]/95 p-5">
                          <p className="text-center font-mono text-xs font-black uppercase tracking-[0.24em] text-[#4ad7ff]">
                            Key Result Metrics
                          </p>

                          <div className="mx-auto mt-4 grid w-full max-w-[940px] gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                            <OverviewStatCard
                              label="Total Tests"
                              value={String(campaignStatus?.total_tests || professionalResultsSummary.total)}
                            />

                            <OverviewStatCard
                              label="Models Tested"
                              value={String(professionalModelComparison.length)}
                              tone="cyan"
                            />

                            <OverviewStatCard
                              label="Blocked"
                              value={String(professionalResultsSummary.blockedAttacks)}
                              tone="green"
                            />

                            <OverviewStatCard
                              label="Successful"
                              value={String(professionalResultsSummary.successfulAttacks)}
                              tone={professionalResultsSummary.successfulAttacks > 0 ? "red" : "green"}
                            />

                            <OverviewStatCard
                              label="Needs Review"
                              value={String(professionalResultsSummary.needsReview)}
                              tone={professionalResultsSummary.needsReview > 0 ? "orange" : "green"}
                            />

                            <OverviewStatCard
                              label="Errors"
                              value={String(professionalResultsSummary.executionErrors)}
                              tone={professionalResultsSummary.executionErrors > 0 ? "orange" : "green"}
                            />

                            <OverviewStatCard
                              label="Avg Output Risk"
                              value={String(professionalResultsSummary.averageResidualRisk)}
                              tone="cyan"
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-[22px] border border-white/[0.05] bg-[#27292a]/95 p-5">
                            <p className="text-center font-mono text-xs font-black uppercase tracking-[0.24em] text-[#4ad7ff]">
                              Threat Coverage
                            </p>

                            <div className="mt-4 grid gap-4">
                              <ProfessionalDistributionCard
                                title="Input Threat Distribution"
                                data={professionalResultsSummary.inputDistribution}
                                emptyText="No input risk metadata returned."
                              />

                              <ProfessionalDistributionCard
                                title="OWASP Mapping Distribution"
                                data={professionalResultsSummary.owaspDistribution}
                                emptyText="No OWASP mapping returned."
                              />
                            </div>
                          </div>

                          <div className="rounded-[22px] border border-white/[0.05] bg-[#27292a]/95 p-5">
                            <p className="text-center font-mono text-xs font-black uppercase tracking-[0.24em] text-[#4ad7ff]">
                              Model Safety Outcome
                            </p>

                            <div className="mt-4 grid gap-4">
                              <ProfessionalDistributionCard
                                title="Model Output Risk Distribution"
                                data={professionalResultsSummary.outputDistribution}
                                emptyText="No output risk data returned."
                              />

                              <ProfessionalDistributionCard
                                title="Final Outcome Distribution"
                                data={professionalResultsSummary.finalDistribution}
                                emptyText="No final outcome data returned."
                              />
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[22px] border border-white/[0.05] bg-[#27292a]/95 p-5">
                          <div className="flex flex-col items-center gap-3 text-center">
                            <p className="font-mono text-xs font-black uppercase tracking-[0.24em] text-[#4ad7ff]">
                              Report Readiness
                            </p>

                            <span className={`w-fit rounded-full border px-4 py-2 text-xs font-black ${
                              professionalResultsSummary.reportReady
                                ? "border-[#30d158]/30 bg-[#30d158]/10 text-[#30d158]"
                                : "border-[#ffb347]/30 bg-[#ffb347]/10 text-[#ffb347]"
                            }`}>
                              {professionalResultsSummary.reportReady ? (professionalResultsSummary.executionErrors > 0 ? "Ready with Warnings" : "Ready") : "Needs Check"}
                            </span>
                          </div>

                          <div className="mx-auto mt-4 grid w-full max-w-[900px] gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            {professionalResultsSummary.readiness.map((item) => (
                              <OverviewStatCard
                                key={item.label}
                                label={item.label}
                                value={item.ready ? "Ready" : "Check"}
                                tone={item.ready ? "green" : "orange"}
                              />
                            ))}
                          </div>
                        </div>
                      </section>
                    )}

                    {resultsDashboardTab === "models" && (
                      <section className="rounded-[22px] border border-white/[0.05] bg-[#27292a]/95 p-5">
                        <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-[#4ad7ff]">
                          Model Comparison
                        </p>
                        <h3 className="mt-2 text-2xl font-black text-white">
                          Ranked Model Performance
                        </h3>

                        <div className="mt-5 overflow-x-auto rounded-[16px] border border-white/[0.06] bg-[#151718]">
                          <table className="w-full min-w-[1020px] border-collapse text-xs">
                            <thead className="bg-[#1f2122]">
                              <tr>
                                {["Rank", "Model", "Tests", "Blocked", "Block Rate", "Successful Attacks", "Errors", "Needs Review", "Avg Output Risk", "Decision"].map((heading) => (
                                  <th key={heading} className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">
                                    {heading}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {professionalModelComparison.map((model, index) => (
                                <tr key={model.model} className="border-t border-white/[0.05]">
                                  <td className="px-3 py-3 font-mono text-[#4ad7ff]">#{index + 1}</td>
                                  <td className="px-3 py-3 font-mono text-[#4ad7ff]">{model.model}</td>
                                  <td className="px-3 py-3 text-[#d4d4d4]">{model.total}</td>
                                  <td className="px-3 py-3 text-[#30d158]">{model.blocked}</td>
                                  <td className="px-3 py-3 font-mono text-[#30d158]">{model.blockRate}%</td>
                                  <td className="px-3 py-3 text-[#ff3434]">{model.successfulAttacks}</td>
                                  <td className="px-3 py-3 text-[#ffb347]">{model.executionErrors}</td>
                                  <td className="px-3 py-3 text-[#4ad7ff]">{model.needsReview}</td>
                                  <td className="px-3 py-3 font-mono text-[#4ad7ff]">{model.averageRisk}</td>
                                  <td className="px-3 py-3">
                                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${resultBadgeTone(model.decision)}`}>
                                      {model.decision}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}

                    {resultsDashboardTab === "reports" && (
                      <section className="space-y-4">
                        <div>
                          <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-[#4ad7ff]">
                            Model Reports
                          </p>
                          <h3 className="mt-2 text-2xl font-black text-white">
                            Report for Each Tested Model
                          </h3>
                        </div>

                        {professionalModelComparison.map((model) => (
                          <div key={model.model} className="rounded-[18px] border border-white/[0.06] bg-[#151718] p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <h4 className="font-mono text-lg font-black text-[#4ad7ff]">{model.model}</h4>
                              <span className={`rounded-full border px-3 py-1 text-xs font-black ${resultBadgeTone(model.decision)}`}>
                                {model.decision}
                              </span>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-6">
                              <MetricCard label="Block Rate" value={`${model.blockRate}%`} tone="green" />
                              <MetricCard label="Blocked" value={String(model.blocked)} tone="green" />
                              <MetricCard label="Successful Attacks" value={String(model.successfulAttacks)} tone={model.successfulAttacks > 0 ? "red" : "green"} />
                              <MetricCard label="Errors" value={String(model.executionErrors)} tone={model.executionErrors > 0 ? "orange" : "green"} />
                              <MetricCard label="Needs Review" value={String(model.needsReview)} tone={model.needsReview > 0 ? "orange" : "green"} />
                              <MetricCard label="Avg Output Risk" value={String(model.averageRisk)} tone="cyan" />
                            </div>
                          </div>
                        ))}
                      </section>
                    )}

                    {resultsDashboardTab === "findings" && (
                      <section className="rounded-[22px] border border-white/[0.05] bg-[#27292a]/95 p-5">
                        <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-[#4ad7ff]">
                          Detailed Findings
                        </p>
                        <h3 className="mt-2 text-2xl font-black text-white">
                          Compact Result List
                        </h3>

                        <div className="mt-5 grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
                          <TextInput value={findingSearch} onChange={setFindingSearch} placeholder="Search by prompt, model, scenario, OWASP..." />

                          <select value={findingModelFilter} onChange={(event) => setFindingModelFilter(event.target.value)} className="h-11 rounded-[12px] border border-white/[0.06] bg-[#151718] px-3 text-xs font-black text-white outline-none">
                            <option value="All">All models</option>
                            {Array.from(new Set(professionalFindings.map((item) => item.model))).map((model) => (
                              <option key={model} value={model}>{model}</option>
                            ))}
                          </select>

                          <select value={findingStatusFilter} onChange={(event) => setFindingStatusFilter(event.target.value)} className="h-11 rounded-[12px] border border-white/[0.06] bg-[#151718] px-3 text-xs font-black text-white outline-none">
                            <option value="All">All decisions</option>
                            <option value="Passed">Passed</option>
                            <option value="Needs Review">Needs Review</option>
                            <option value="Failed">Failed</option>
                            <option value="Execution Error">Execution Error</option>
                          </select>

                          <select value={findingRiskFilter} onChange={(event) => setFindingRiskFilter(event.target.value)} className="h-11 rounded-[12px] border border-white/[0.06] bg-[#151718] px-3 text-xs font-black text-white outline-none">
                            <option value="All">All risks</option>
                            {Array.from(new Set([...professionalFindings.map((item) => item.inputRisk), ...professionalFindings.map((item) => item.outputRisk)])).map((risk) => (
                              <option key={risk} value={risk}>{risk}</option>
                            ))}
                          </select>
                        </div>

                        <div className="mt-5 overflow-x-auto rounded-[16px] border border-white/[0.06] bg-[#151718]">
                          <table className="w-full min-w-[1120px] border-collapse text-xs">
                            <thead className="bg-[#1f2122]">
                              <tr>
                                {["Result", "Model", "Input Risk", "Output Risk", "Decision", "OWASP", "Prompt Preview", "Action"].map((heading) => (
                                  <th key={heading} className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">
                                    {heading}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filteredProfessionalFindings.length === 0 ? (
                                <tr>
                                  <td colSpan={8} className="px-3 py-8 text-center text-sm font-semibold text-[#727272]">
                                    No results match the selected filters.
                                  </td>
                                </tr>
                              ) : filteredProfessionalFindings.map((item) => (
                                <tr key={`${item.resultId}-${item.index}`} className="border-t border-white/[0.05]">
                                  <td className="px-3 py-3">
                                    <p className="font-mono text-[#4ad7ff]">#{item.index + 1}</p>
                                    <p className="mt-1 max-w-[180px] truncate font-semibold text-white">{item.title}</p>
                                  </td>
                                  <td className="px-3 py-3 font-mono text-[#d4d4d4]">{item.model}</td>
                                  <td className="px-3 py-3 text-[#ffb347]">{item.inputRisk} {item.inputScore ? `(${item.inputScore})` : ""}</td>
                                  <td className="px-3 py-3 text-[#4ad7ff]">{item.outputRisk} ({item.outputScore})</td>
                                  <td className="px-3 py-3">
                                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${resultBadgeTone(item.decision)}`}>
                                      {item.decision}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-[#d4d4d4]">{item.owasp}</td>
                                  <td className="max-w-[360px] truncate px-3 py-3 text-[#727272]">{item.prompt}</td>
                                  <td className="px-3 py-3">
                                    <button type="button" onClick={() => setSelectedFinding(item.raw)} className="rounded-full border border-[#4ad7ff]/30 bg-[#4ad7ff]/10 px-3 py-1 text-[10px] font-black text-[#4ad7ff]">
                                      View Details
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}
                  </>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-[#353637] bg-[#27292a] p-8 text-center">
                    <h3 className="text-xl font-black text-white">No results loaded yet.</h3>
                    <div className="mt-5">
                      <SoftButton onClick={() => campaignId.trim() && loadCampaignStatusAndResults(campaignId.trim())}>
                        Refresh Current Campaign Results
                      </SoftButton>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/[0.06] bg-[#1f2122]/95 px-5 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <div className="flex flex-wrap gap-3">
                    <SoftButton onClick={() => setResultsDashboardOpen(false)}>
                      Close
                    </SoftButton>
                    <PrimaryButton
                      onClick={() => {
                        setNotice("Campaign results sent to Reports successfully.");
                        window.location.href = campaignId
                          ? `/reports?campaign_id=${encodeURIComponent(campaignId)}`
                          : "/reports";
                      }}
                      disabled={!professionalResultsSummary.total}
                    >
                      Send to Reports
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            </div>

            {selectedFinding !== null && (
              <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur">
                {(() => {
                  const item = professionalFindings.find((finding) => finding.raw === selectedFinding);

                  if (!item) return null;

                  return (
                    <div className="max-h-[86vh] w-full max-w-4xl overflow-y-auto rounded-[24px] border border-white/[0.08] bg-[#1f2122] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.6)]">
                      <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-mono text-xs font-black uppercase tracking-[0.24em] text-[#4ad7ff]">
                            Result Details
                          </p>
                          <h3 className="mt-2 text-2xl font-black text-white">{item.title}</h3>
                          <p className="mt-1 font-mono text-xs text-[#727272]">{item.model} • {item.mutation}</p>
                        </div>
                        <SoftButton onClick={() => setSelectedFinding(null)}>Close</SoftButton>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-4">
                        <MetricCard label="Input Risk" value={`${item.inputRisk}${item.inputScore ? ` (${item.inputScore})` : ""}`} tone="orange" />
                        <MetricCard label="Output Risk" value={`${item.outputRisk} (${item.outputScore})`} tone="cyan" />
                        <MetricCard label="Decision" value={item.decision} tone={item.decision === "Passed" ? "green" : item.decision === "Failed" ? "red" : "orange"} />
                        <MetricCard label="Confidence" value={item.confidence} tone="cyan" />
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-[16px] border border-white/[0.06] bg-[#27292a] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#727272]">Prompt</p>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#d4d4d4]">{item.prompt}</p>
                        </div>

                        <div className="rounded-[16px] border border-white/[0.06] bg-[#27292a] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#727272]">Model Response</p>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#d4d4d4]">{item.modelResponse}</p>
                        </div>

                        <div className="rounded-[16px] border border-white/[0.06] bg-[#27292a] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#727272]">Input Risk Reason</p>
                          <p className="mt-3 text-sm leading-7 text-[#d4d4d4]">{item.inputReason}</p>
                        </div>

                        <div className="rounded-[16px] border border-white/[0.06] bg-[#27292a] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#727272]">Output Evaluation Reason</p>
                          <p className="mt-3 text-sm leading-7 text-[#d4d4d4]">{item.outputReason}</p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <MetricCard label="OWASP Mapping" value={item.owasp} tone="cyan" />
                        <MetricCard label="Subcategory" value={item.subcategory} />
                        <MetricCard label="Metadata Source" value={item.metadataSource} />
                      </div>

                      {item.errorMessage && (
                        <div className="mt-5 rounded-[16px] border border-[#ffb347]/30 bg-[#ffb347]/10 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffb347]">Execution Error</p>
                          <p className="mt-3 text-sm leading-7 text-[#ffd9a0]">{item.errorMessage}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        <section className="rounded-[20px] border border-white/[0.05] bg-[#27292a]/90 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.14)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-xs font-black uppercase tracking-[0.28em] text-[#4ad7ff]">
                Recent Campaigns
              </p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-white">
                Recent Campaigns
              </h2>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-[#a9a9a9]">
                Backend campaign history with live status, test progress, risk, and results.
              </p>
            </div>

            <SoftButton onClick={handleClearRecentCampaigns}>Clear Local History</SoftButton>
          </div>

          <div className="mt-4 rounded-[14px] border border-white/[0.06] bg-[#1f2122]/80 p-2.5">
            <div className="grid gap-2.5 md:grid-cols-[1.3fr_0.75fr_0.8fr_0.8fr_auto]">
              <TextInput
                value={recentSearch}
                onChange={setRecentSearch}
                placeholder="Search campaigns..."
              />

              <select
                value={recentStatusFilter}
                onChange={(event) => setRecentStatusFilter(event.target.value)}
                className="h-11 rounded-[12px] border border-white/[0.06] bg-[#151718] px-3 text-xs font-black text-white outline-none"
              >
                <option value="All">All statuses</option>
                <option value="draft">Draft</option>
                <option value="queued">Queued</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>

              <select
                value={recentSourceFilter}
                onChange={(event) => setRecentSourceFilter(event.target.value)}
                className="h-11 rounded-[12px] border border-white/[0.06] bg-[#151718] px-3 text-xs font-black text-white outline-none"
              >
                <option value="All">All sources</option>
                <option value="Dataset">Dataset</option>
                <option value="Library assets">Library assets</option>
              </select>

              <select
                value={recentRiskFilter}
                onChange={(event) => setRecentRiskFilter(event.target.value)}
                className="h-11 rounded-[12px] border border-white/[0.06] bg-[#151718] px-3 text-xs font-black text-white outline-none"
              >
                <option value="All">All risks</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>

              <SoftButton
                onClick={() => {
                  setRecentSearch("");
                  setRecentStatusFilter("All");
                  setRecentSourceFilter("All");
                  setRecentRiskFilter("All");
                }}
              >
                Clear
              </SoftButton>
            </div>
          </div>

          <div className="mt-4 max-h-[320px] overflow-y-auto rounded-[14px] border border-white/[0.06]">
            <table className="w-full min-w-[820px] border-collapse text-xs">
              <thead className="sticky top-0 bg-[#1f2122]">
                <tr>
                  {["Campaign", "Source", "Models", "Status", "Tests", "Risk", "Updated", "Action"].map((heading) => (
                    <th key={heading} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecentCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-[#727272]">
                      No recent campaigns match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecentCampaigns.map((campaign) => (
                    <tr key={campaign.campaign_id} className="border-t border-white/[0.05] hover:bg-white/[0.025]">
                      <td className="px-3 py-2.5">
                        <p className="truncate font-semibold text-white">{campaign.name}</p>
                        <p className="mt-1 font-mono text-xs text-[#4ad7ff]">{campaign.campaign_id}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#d4d4d4]">{campaign.dataset_name || "Library assets"}</td>
                      <td className="px-3 py-2.5 text-xs text-[#d4d4d4]">{getCampaignModelLabel(campaign)}</td>
                      <td className="px-3 py-2.5 text-xs font-bold text-[#d4d4d4]">{formatStatus(campaign.status || "Unknown")}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-[#d4d4d4]">{campaign.completed_tests || 0}/{campaign.total_tests || 0}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-[#d4d4d4]">{campaign.average_risk_score || 0}</td>
                      <td className="px-3 py-2.5 text-xs text-[#727272]">{formatDate(campaign.updated_at)}</td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => handleOpenRecentCampaign(campaign.campaign_id)}
                          className="rounded-full border border-[#4ad7ff]/30 bg-[#4ad7ff]/10 px-3 py-1 text-[10px] font-black text-[#4ad7ff]"
                        >
                          View
                        </button>
                  <button
                    type="button"
                    onClick={() => handleSendRecentCampaignToReports(campaign.campaign_id)}
                    className="rounded-full border border-[#30d158]/35 bg-[#30d158]/10 px-3 py-1.5 text-xs font-semibold text-[#30d158] transition hover:bg-[#30d158]/15"
                  >
                    Send to Reports
                  </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selectedCampaign && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-8">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-[24px] border border-white/[0.08] bg-[#1f2122] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
              <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-mono text-xs font-black uppercase tracking-[0.24em] text-[#4ad7ff]">
                    Campaign Details
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    {selectedCampaign.name}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-[#4ad7ff]">
                    {selectedCampaign.campaign_id}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCampaign(null)}
                  className="rounded-full border border-white/[0.08] bg-[#27292a] px-4 py-2 text-xs font-black text-white"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <MetricCard
                  label="Source"
                  value={selectedCampaign.dataset_name || "Library assets"}
                  tone="cyan"
                />
                <MetricCard
                  label="Models"
                  value={getCampaignModelLabel(selectedCampaign)}
                  tone="cyan"
                />
                <MetricCard
                  label="Status"
                  value={formatStatus(selectedCampaign.status || "Unknown")}
                  tone={selectedCampaign.status === "completed" ? "green" : selectedCampaign.status === "failed" ? "red" : "orange"}
                />
                <MetricCard
                  label="Tests"
                  value={`${selectedCampaign.completed_tests || 0}/${selectedCampaign.total_tests || 0}`}
                  tone="green"
                />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Risk"
                  value={selectedCampaign.average_risk_score || 0}
                  tone={(selectedCampaign.average_risk_score || 0) > 70 ? "red" : (selectedCampaign.average_risk_score || 0) > 35 ? "orange" : "green"}
                />
                <MetricCard
                  label="Critical Findings"
                  value={selectedCampaign.critical_findings || 0}
                  tone={(selectedCampaign.critical_findings || 0) > 0 ? "red" : "green"}
                />
                <MetricCard
                  label="Updated"
                  value={formatDate(selectedCampaign.updated_at)}
                  tone="cyan"
                />
              </div>

              <div className="mt-5 rounded-[18px] border border-white/[0.06] bg-[#27292a] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#727272]">
                  History note
                </p>
                <p className="mt-3 text-sm leading-7 text-[#d4d4d4]">
                  This window reviews a saved campaign from local history. The main campaign wizard stays unchanged in the background.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <SoftButton
                  onClick={() => {
                    window.location.href = `/reports?campaign_id=${encodeURIComponent(selectedCampaign.campaign_id)}`;
                  }}
                >
                  Send to Reports
                </SoftButton>

                <PrimaryButton
                  onClick={() => setSelectedCampaign(null)}
                >
                  Done
                </PrimaryButton>
              </div>
            </div>
          </div>
        )}

        {selectedResult && (() => {
          const selectedRecord = hxgToRecord(selectedResult);
          const reportRecord = hxgToRecord(
            selectedRecord.sandbox_report ||
              selectedRecord.report ||
              selectedRecord.evaluation_report ||
              selectedRecord
          );

          const modelResponseRecord = hxgToRecord(
            reportRecord.model_response || selectedRecord.model_response
          );

          const evaluationRecord = hxgToRecord(
            reportRecord.output_evaluation ||
              reportRecord.evaluation ||
              selectedRecord.output_evaluation ||
              selectedRecord.evaluation
          );

          const riskRecord = hxgToRecord(
            reportRecord.risk_assessment || selectedRecord.risk_assessment
          );

          const title = hxgText(
            selectedRecord.attack_name || selectedRecord.scenario_id,
            "Automated Test Result"
          );

          const selectedModel = hxgText(
            selectedRecord.model_name || selectedRecord.model || selectedRecord.provider,
            "Unknown model"
          );

          const promptText = hxgText(
            selectedRecord.mutated_prompt || selectedRecord.input_prompt,
            "Prompt not available."
          );

          const modelOutput = hxgText(
            modelResponseRecord.output ||
              modelResponseRecord.response ||
              modelResponseRecord.text ||
              reportRecord.model_output ||
              selectedRecord.model_output ||
              selectedRecord.response ||
              selectedRecord.output,
            "No clear model output was returned."
          );

          const reasoning = hxgText(
            evaluationRecord.reasoning ||
              evaluationRecord.summary ||
              evaluationRecord.explanation ||
              reportRecord.reasoning ||
              selectedRecord.reasoning,
            "No evaluator reasoning was returned."
          );

          const recommendation = hxgText(
            evaluationRecord.recommendation ||
              reportRecord.recommendation ||
              riskRecord.recommendation,
            "No recommendation was returned."
          );

          const evidenceItems = hxgList(
            evaluationRecord.evidence || reportRecord.evidence || selectedRecord.evidence
          );

          return (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 py-8">
              <div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-[24px] border border-white/[0.08] bg-[#1f2122] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
                <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-mono text-xs font-black uppercase tracking-[0.24em] text-[#4ad7ff]">
                      Campaign Results Overview
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-white">
                      Model Comparison & Test Analysis
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a9a9a9]">
                      Review the campaign-level result summary, compare model performance, and inspect the selected test case.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedResult(null)}
                    className="rounded-full border border-white/[0.08] bg-[#27292a] px-4 py-2 text-xs font-black text-white"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-5">
                  <MetricCard label="Total Tests" value={String(resultsSummary.total)} />
                  <MetricCard label="Passed" value={String(resultsSummary.passed)} tone="green" />
                  <MetricCard label="Unsafe" value={String(resultsSummary.unsafe)} tone={resultsSummary.unsafe > 0 ? "red" : "green"} />
                  <MetricCard label="High Risk" value={String(resultsSummary.highRisk)} tone={resultsSummary.highRisk > 0 ? "orange" : "green"} />
                  <MetricCard label="Average Risk" value={String(resultsSummary.averageRisk)} tone="cyan" />
                </div>

                <div className="mt-5 rounded-[18px] border border-white/[0.06] bg-[#27292a] p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#727272]">
                        Model Comparison
                      </p>
                      <h4 className="mt-2 text-lg font-black text-white">
                        Performance by selected model
                      </h4>
                    </div>
                    <p className="text-xs font-semibold text-[#a9a9a9]">
                      Shows pass rate, unsafe count, and average risk per model.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {modelComparison.length > 0 ? (
                      modelComparison.map((item) => (
                        <div key={item.model} className="rounded-[14px] border border-white/[0.05] bg-[#151718] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-sm font-black text-[#4ad7ff]">
                                {item.model}
                              </p>
                              <p className="mt-1 text-xs text-[#727272]">
                                {item.total} test(s) executed
                              </p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${
                              item.unsafe > 0
                                ? "border border-[#ff3434]/25 bg-[#ff3434]/10 text-[#ff3434]"
                                : "border border-[#30d158]/25 bg-[#30d158]/10 text-[#30d158]"
                            }`}>
                              {item.passRate}% pass
                            </span>
                          </div>

                          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                            <div className="rounded-[10px] bg-white/[0.03] px-2 py-2">
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#727272]">Passed</p>
                              <p className="mt-1 font-mono text-sm font-black text-[#30d158]">{item.passed}</p>
                            </div>
                            <div className="rounded-[10px] bg-white/[0.03] px-2 py-2">
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#727272]">Unsafe</p>
                              <p className="mt-1 font-mono text-sm font-black text-[#ff3434]">{item.unsafe}</p>
                            </div>
                            <div className="rounded-[10px] bg-white/[0.03] px-2 py-2">
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#727272]">High</p>
                              <p className="mt-1 font-mono text-sm font-black text-[#ffb347]">{item.highRisk}</p>
                            </div>
                            <div className="rounded-[10px] bg-white/[0.03] px-2 py-2">
                              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#727272]">Avg Output Risk</p>
                              <p className="mt-1 font-mono text-sm font-black text-[#4ad7ff]">{item.averageRisk}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[14px] border border-dashed border-[#353637] bg-[#151718] p-5 text-sm text-[#727272]">
                        No model comparison data is available yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-[18px] border border-white/[0.06] bg-[#27292a] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#727272]">
                    Selected Test Result
                  </p>
                  <h4 className="mt-2 text-xl font-black text-white">
                    {title}
                  </h4>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <MetricCard label="Model" value={selectedModel} tone="cyan" />
                    <MetricCard label="Risk" value={getRiskLevel(selectedResult)} tone={isUnsafe(selectedResult) ? "red" : "green"} />
                    <MetricCard label="Status" value={getFinalStatus(selectedResult)} tone={isUnsafe(selectedResult) ? "red" : "green"} />
                  </div>

                  <div className="mt-4 rounded-[14px] border border-white/[0.05] bg-[#151718] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                      Prompt
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#d7d7d7]">
                      {promptText}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[18px] border border-white/[0.06] bg-[#27292a] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#727272]">
                      Model Output
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#d7d7d7]">
                      {modelOutput}
                    </p>
                  </div>

                  <div className="rounded-[18px] border border-white/[0.06] bg-[#27292a] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#727272]">
                      Evaluator Reasoning
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[#d7d7d7]">
                      {reasoning}
                    </p>

                    {evidenceItems.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
                          Evidence
                        </p>
                        <div className="mt-2 space-y-2">
                          {evidenceItems.map((item, index) => (
                            <div key={`${item}-${index}`} className="rounded-[10px] bg-white/[0.03] px-3 py-2 text-sm leading-6 text-[#d7d7d7]">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-[18px] border border-white/[0.06] bg-[#27292a] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#727272]">
                    Recommendation
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#d7d7d7]">
                    {recommendation}
                  </p>
                </div>

                <details className="mt-5 rounded-[18px] border border-white/[0.06] bg-[#27292a] p-4">
                  <summary className="cursor-pointer text-sm font-black text-[#4ad7ff]">
                    View raw technical JSON
                  </summary>
                  <pre className="mt-4 max-h-[260px] overflow-auto rounded-[12px] bg-[#101112] p-4 text-xs leading-6 text-[#bdbdbd]">
                    {JSON.stringify(reportRecord, null, 2)}
                  </pre>
                </details>

                <div className="mt-5 flex justify-end">
                  <PrimaryButton onClick={() => setSelectedResult(null)}>
                    Done
                  </PrimaryButton>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

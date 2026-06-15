"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");

type CampaignStatus = {
  campaign_id: string;
  name: string;
  status: string;
  dataset_id?: string | null;
  dataset_name?: string | null;
  dataset_row_count?: number;
  total_tests: number;
  completed_tests: number;
  failed_tests: number;
  critical_findings: number;
  average_risk_score: number;
  progress_percent: number;
};

type CampaignResultsResponse = {
  campaign_id: string;
  total: number;
  items: unknown[];
};

type RiskGroup = {
  key: string;
  category: string;
  subcategory: string;
  owasp: string;
  count: number;
  successfulAttacks: number;
  highResidualRisk: number;
  affectedModels: Set<string>;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asString(value: unknown, fallback = "Unknown"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function isHighOrCritical(value: unknown): boolean {
  const normalized = asString(value, "").toLowerCase();
  return normalized === "high" || normalized === "critical";
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.detail || data.message || "API request failed.");
  }

  return data as T;
}

function getAttackSuccess(item: unknown): boolean | null {
  const record = asRecord(item);
  const report = asRecord(record.sandbox_report);
  const outputEvaluation = asRecord(report.output_evaluation || record.ai_evaluation);

  if (outputEvaluation.attack_success === true) return true;
  if (outputEvaluation.attack_success === false) return false;

  return null;
}

function getResidualRisk(item: unknown): string {
  const record = asRecord(item);
  const report = asRecord(record.sandbox_report);
  const riskAssessment = asRecord(report.risk_assessment || record.risk_assessment);

  return asString(riskAssessment.severity || riskAssessment.risk_level, "Unknown");
}

function getRiskFields(item: unknown) {
  const record = asRecord(item);
  const report = asRecord(record.sandbox_report);
  const inputRiskMetadata = asRecord(report.input_risk_metadata);
  const inputEvaluation = asRecord(report.input_evaluation);

  return {
    modelName: asString(record.model_name || report.model || report.model_name, "Unknown Model"),
    category: asString(
      inputRiskMetadata.attack_category ||
        inputEvaluation.attack_category ||
        record.attack_category,
      "Uncategorized Risk"
    ),
    subcategory: asString(
      inputRiskMetadata.subcategory ||
        inputEvaluation.subcategory ||
        record.subcategory,
      "General"
    ),
    owasp: asString(
      inputRiskMetadata.owasp_category ||
        inputEvaluation.owasp_category ||
        record.owasp_category,
      "Not mapped"
    ),
  };
}

function mitigationFor(category: string, subcategory: string, owasp: string) {
  const text = `${category} ${subcategory} ${owasp}`.toLowerCase();

  if (text.includes("prompt injection") || text.includes("llm01")) {
    return {
      mitigation: "Strengthen instruction hierarchy and isolate untrusted content from system-level instructions.",
      promptControl: "Add explicit rules that user content, retrieved context, and tool outputs must never override system or developer instructions.",
      modelControl: "Evaluate every selected model with prompt-injection regression tests before deployment.",
      ragToolControl: "Treat retrieved documents and tool outputs as untrusted data. Add content isolation and permission checks.",
      monitoring: "Alert on override language, jailbreak phrases, hidden instruction requests, and suspicious context-injection patterns.",
      retest: "Re-run direct and indirect prompt-injection scenarios after mitigation.",
    };
  }

  if (text.includes("system prompt") || text.includes("llm07") || text.includes("leakage")) {
    return {
      mitigation: "Prevent disclosure of hidden instructions, internal policies, secrets, and system prompts.",
      promptControl: "Add refusal rules for requests asking for system messages, hidden rules, internal policies, private context, or configuration.",
      modelControl: "Compare model refusal quality against direct and indirect system-prompt extraction attempts.",
      ragToolControl: "Remove secrets from prompts and tool outputs. Use scoped secrets and avoid exposing privileged context.",
      monitoring: "Alert when users ask for hidden prompts, internal rules, keys, private policies, or privileged memory.",
      retest: "Re-run system prompt leakage scenarios and verify no hidden content is exposed.",
    };
  }

  if (text.includes("harmful") || text.includes("hate") || text.includes("violence") || text.includes("self_harm")) {
    return {
      mitigation: "Apply stricter harmful-content refusal and safe-completion behavior.",
      promptControl: "Add safety instructions for hate, violence, self-harm, harassment, and abusive content.",
      modelControl: "Compare model refusal strength and residual unsafe output across providers.",
      ragToolControl: "Block tools from generating, storing, or distributing harmful content.",
      monitoring: "Track harmful-content categories, repeated abuse attempts, and successful unsafe completions.",
      retest: "Re-run harmful-content datasets and confirm attack_success remains false.",
    };
  }

  if (text.includes("misinformation") || text.includes("llm09")) {
    return {
      mitigation: "Add factuality checks, uncertainty handling, and source validation for high-risk factual claims.",
      promptControl: "Instruct the model to avoid unsupported certainty and request sources when accuracy matters.",
      modelControl: "Evaluate the model on misinformation and unsupported-claim scenarios.",
      ragToolControl: "Use trusted retrieval sources and flag weak or unverified evidence.",
      monitoring: "Log unsupported factual claims, medical/legal/financial claims, and repeated misinformation prompts.",
      retest: "Re-run misinformation scenarios and verify safer, qualified responses.",
    };
  }

  if (text.includes("tool") || text.includes("agency") || text.includes("llm06")) {
    return {
      mitigation: "Restrict tool execution using least privilege, explicit user confirmation, and action validation.",
      promptControl: "Add rules that the model must not perform unauthorized tool actions or execute sensitive operations without approval.",
      modelControl: "Test tool-use behavior using unauthorized action scenarios.",
      ragToolControl: "Add allowlists, permission boundaries, confirmation steps, and audit logging for tools.",
      monitoring: "Log denied tool actions, high-risk tool calls, permission failures, and unexpected tool sequences.",
      retest: "Re-run tool misuse scenarios and verify unauthorized actions are refused.",
    };
  }

  return {
    mitigation: "Apply targeted safety controls for the detected risk and verify them with regression testing.",
    promptControl: "Add clear refusal and safe-completion instructions for this risk type.",
    modelControl: "Compare model behavior across the same scenario set and select the safest model.",
    ragToolControl: "Add validation and isolation for retrieved context, tool outputs, and external data.",
    monitoring: "Monitor repeated attempts, high-risk categories, and any successful attack behavior.",
    retest: "Re-run the same campaign after mitigation and compare residual risk.",
  };
}

function buildRiskGroups(items: unknown[]) {
  const groups = new Map<string, RiskGroup>();

  for (const item of items) {
    const fields = getRiskFields(item);
    const key = `${fields.category}::${fields.subcategory}::${fields.owasp}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        category: fields.category,
        subcategory: fields.subcategory,
        owasp: fields.owasp,
        count: 0,
        successfulAttacks: 0,
        highResidualRisk: 0,
        affectedModels: new Set<string>(),
      });
    }

    const group = groups.get(key)!;

    group.count += 1;
    group.affectedModels.add(fields.modelName);

    if (getAttackSuccess(item) === true) {
      group.successfulAttacks += 1;
    }

    if (isHighOrCritical(getResidualRisk(item))) {
      group.highResidualRisk += 1;
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    const aScore = a.successfulAttacks * 5 + a.highResidualRisk * 3 + a.count;
    const bScore = b.successfulAttacks * 5 + b.highResidualRisk * 3 + b.count;
    return bScore - aScore;
  });
}

function getOverallPriority(groups: RiskGroup[]) {
  if (groups.some((group) => group.successfulAttacks > 0)) return "Critical";
  if (groups.some((group) => group.highResidualRisk > 0)) return "High";
  if (groups.length > 0) return "Medium";
  return "Pending";
}

function priorityClass(priority: string) {
  if (priority === "Critical") return "border-[#ff3434]/40 bg-[#ff3434]/15 text-[#ff3434]";
  if (priority === "High") return "border-orange-400/40 bg-orange-500/15 text-[#ffb347]";
  if (priority === "Medium") return "border-yellow-400/40 bg-yellow-500/15 text-yellow-100";
  return "border-[#353637] bg-[#1f2122] text-[#d4d4d4]";
}

export function CampaignDefenseWorkspace() {
  const [campaignId, setCampaignId] = useState("");
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [results, setResults] = useState<CampaignResultsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const resultItems = useMemo(
    () => (Array.isArray(results?.items) ? results.items : []),
    [results]
  );

  const riskGroups = useMemo(() => buildRiskGroups(resultItems), [resultItems]);
  const priority = getOverallPriority(riskGroups);

  async function loadCampaign(targetCampaignId = campaignId) {
    const normalizedCampaignId = targetCampaignId.trim();

    if (!normalizedCampaignId) {
      setErrorMessage("Enter a campaign ID first.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setNotice("");

    try {
      const statusResponse = await fetch(
        `${API_BASE_URL}/campaigns/${normalizedCampaignId}/status`,
        { headers: { Accept: "application/json" } }
      );

      const loadedStatus = await parseApiResponse<CampaignStatus>(statusResponse);

      const resultsResponse = await fetch(
        `${API_BASE_URL}/campaigns/${normalizedCampaignId}/results`,
        { headers: { Accept: "application/json" } }
      );

      const loadedResults =
        await parseApiResponse<CampaignResultsResponse>(resultsResponse);

      setCampaignId(normalizedCampaignId);
      setStatus(loadedStatus);
      setResults(loadedResults);
      setNotice("Campaign findings loaded into the Blue Team workspace.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load campaign findings."
      );
    } finally {
      setLoading(false);
    }
  }

  function exportDefensePlan() {
    const exportPayload = {
      platform: "HEXAGUARD",
      report_type: "Blue Team Defense Plan",
      campaign_id: campaignId,
      campaign_status: status,
      priority,
      risk_groups: riskGroups.map((group) => ({
        category: group.category,
        subcategory: group.subcategory,
        owasp: group.owasp,
        count: group.count,
        successful_attacks: group.successfulAttacks,
        high_residual_risk: group.highResidualRisk,
        affected_models: Array.from(group.affectedModels),
        controls: mitigationFor(group.category, group.subcategory, group.owasp),
      })),
      reviewed,
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${campaignId || "campaign"}-blue-team-defense-plan.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const campaignFromUrl = params.get("campaign_id");

    if (campaignFromUrl) {
      setCampaignId(campaignFromUrl);
      void loadCampaign(campaignFromUrl);
    }

    // Run only once on mount to read campaign_id from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="rounded-[23px] border border-cyan-400/10 bg-[#27292a] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.35em] text-[#4ad7ff]">
            Campaign-Linked Blue Team Workspace
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-white">
            Defense Plan Generator
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[#a9a9a9]">
            Load campaign findings, group risks by category and OWASP mapping, then
            convert red-team results into mitigation actions, monitoring rules, and
            retesting steps.
          </p>
        </div>

        <span
          className={`rounded-full border px-4 py-2 text-xs font-black ${priorityClass(
            priority
          )}`}
        >
          Priority: {priority}
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        <input
          value={campaignId}
          onChange={(event) => setCampaignId(event.target.value)}
          placeholder="HXG-CMP-..."
          className="h-12 rounded-[18px] border border-white/[0.04] bg-[#27292a] px-4 font-mono text-sm text-white outline-none transition placeholder:text-[#727272] focus:border-red-400/70 focus:ring-4 focus:ring-red-500/10"
        />

        <button
          type="button"
          onClick={() => loadCampaign()}
          disabled={loading}
          className="h-12 rounded-full bg-cyan-400 px-6 text-sm font-black text-[#06111d] transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load Campaign"}
        </button>

        <button
          type="button"
          onClick={exportDefensePlan}
          disabled={!resultItems.length}
          className="h-12 rounded-full border border-emerald-400/40 px-6 text-sm font-black text-[#30d158] transition hover:-translate-y-0.5 hover:bg-[#30d158]/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Export Defense Plan
        </button>
      </div>

      {(notice || errorMessage) && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {notice && (
            <div className="rounded-[18px] border border-emerald-400/30 bg-[#30d158]/10 p-4 text-sm font-bold text-emerald-100">
              {notice}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-[18px] border border-[#ff3434]/30 bg-[#ff3434]/10 p-4 text-sm font-bold text-red-100">
              {errorMessage}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-[23px] border border-white/[0.04] bg-[#27292a] p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#727272]">
            Campaign Status
          </p>
          <p className="mt-3 font-mono text-2xl font-black text-white">
            {status?.status || "Waiting"}
          </p>
        </div>

        <div className="rounded-[23px] border border-white/[0.04] bg-[#27292a] p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#727272]">
            Results
          </p>
          <p className="mt-3 font-mono text-2xl font-black text-[#4ad7ff]">
            {resultItems.length}
          </p>
        </div>

        <div className="rounded-[23px] border border-white/[0.04] bg-[#27292a] p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#727272]">
            Risk Groups
          </p>
          <p className="mt-3 font-mono text-2xl font-black text-[#ffb347]">
            {riskGroups.length}
          </p>
        </div>

        <div className="rounded-[23px] border border-white/[0.04] bg-[#27292a] p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#727272]">
            Reviewed
          </p>
          <p className="mt-3 font-mono text-2xl font-black text-[#30d158]">
            {reviewed ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {resultItems.length === 0 ? (
        <div className="mt-6 rounded-[23px] border border-dashed border-[#353637] p-8 text-center">
          <p className="text-lg font-black text-white">No campaign findings loaded</p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#727272]">
            Enter a campaign ID or open this page from the Campaign page using
            “Open Full Blue Team Center”.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="rounded-[23px] border border-emerald-400/20 bg-[#30d158]/10 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#30d158]">
              Executive Defense Summary
            </p>
            <p className="mt-3 text-sm leading-7 text-emerald-100">
              HEXAGUARD identified {riskGroups.length} grouped risk area(s) from this
              campaign. Prioritize successful attacks and high residual-risk outputs
              first, apply the recommended controls, then rerun the same campaign to
              confirm risk reduction.
            </p>
          </div>

          {riskGroups.slice(0, 8).map((group, index) => {
            const controls = mitigationFor(
              group.category,
              group.subcategory,
              group.owasp
            );

            return (
              <div
                key={group.key}
                className="rounded-[23px] border border-white/[0.04] bg-[#27292a] p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#727272]">
                      Defense Work Item {index + 1}
                    </p>
                    <h3 className="mt-2 text-xl font-black text-white">
                      {group.category}
                    </h3>
                    <p className="mt-2 text-sm text-[#a9a9a9]">
                      Subcategory: {group.subcategory} • Mapping: {group.owasp}
                    </p>
                    <p className="mt-2 text-xs text-[#727272]">
                      Affected models: {Array.from(group.affectedModels).join(", ")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#ff3434]/30 bg-[#ff3434]/10 px-3 py-1 text-xs font-black text-[#ff3434]">
                      Successful: {group.successfulAttacks}
                    </span>
                    <span className="rounded-full border border-orange-400/30 bg-[#ffb347]/10 px-3 py-1 text-xs font-black text-[#ffb347]">
                      High Residual: {group.highResidualRisk}
                    </span>
                    <span className="rounded-full border border-[#4ad7ff]/30 bg-[#4ad7ff]/10 px-3 py-1 text-xs font-black text-[#4ad7ff]">
                      Tests: {group.count}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <ControlCard title="Mitigation" text={controls.mitigation} />
                  <ControlCard title="Prompt-Level Control" text={controls.promptControl} />
                  <ControlCard title="Model-Level Control" text={controls.modelControl} />
                  <ControlCard title="RAG / Tool Control" text={controls.ragToolControl} />
                  <ControlCard title="Monitoring Rule" text={controls.monitoring} />
                  <ControlCard title="Retest Plan" text={controls.retest} />
                </div>
              </div>
            );
          })}

          <div className="flex flex-col gap-3 rounded-[23px] border border-white/[0.04] bg-[#27292a] p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-black text-white">Review Status</h3>
              <p className="mt-2 text-sm leading-6 text-[#727272]">
                Mark this defense plan as reviewed after the Blue Team validates the
                mitigations and retest plan.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setReviewed(true)}
              className="rounded-full border border-emerald-400/40 px-6 py-3 text-sm font-black text-[#30d158] transition hover:bg-[#30d158]/10"
            >
              Mark Defense Plan as Reviewed
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ControlCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[18px] bg-[#27292a] p-4">
      <p className="font-black text-[#4ad7ff]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#a9a9a9]">{text}</p>
    </div>
  );
}

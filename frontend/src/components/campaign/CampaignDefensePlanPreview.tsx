"use client";

import { useMemo, useState } from "react";

type DefensePlanPreviewProps = {
  campaignId: string;
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
      control: "Strengthen instruction hierarchy and isolate untrusted user or retrieved content from system-level instructions.",
      prompt: "Add explicit rules that user content, retrieved context, and tool outputs must never override system or developer instructions.",
      model: "Evaluate the model with prompt-injection regression tests before deployment.",
      monitoring: "Log prompt-injection indicators, suspicious override language, and attempts to reveal hidden instructions.",
      retest: "Re-run prompt injection and indirect injection scenarios after mitigation.",
    };
  }

  if (text.includes("system prompt") || text.includes("llm07") || text.includes("leakage")) {
    return {
      control: "Prevent disclosure of hidden instructions, internal policies, secrets, and system prompts.",
      prompt: "Add refusal rules for requests asking for system messages, hidden instructions, private policies, or internal configuration.",
      model: "Test the model against direct and indirect system prompt extraction attempts.",
      monitoring: "Alert when users ask for hidden prompts, internal rules, secret keys, or privileged context.",
      retest: "Re-run system prompt leakage scenarios and verify no hidden content is exposed.",
    };
  }

  if (text.includes("harmful") || text.includes("hate") || text.includes("violence") || text.includes("self_harm")) {
    return {
      control: "Apply stricter harmful-content refusal and safe-completion behavior.",
      prompt: "Add safety instructions for hate, violence, self-harm, harassment, and abusive content requests.",
      model: "Compare model refusal quality and residual unsafe output across providers.",
      monitoring: "Track harmful-content categories, repeated abuse attempts, and successful unsafe completions.",
      retest: "Re-run harmful-content datasets and confirm attack_success remains false.",
    };
  }

  if (text.includes("misinformation") || text.includes("llm09")) {
    return {
      control: "Add factuality checks, uncertainty handling, and citation requirements for high-risk claims.",
      prompt: "Instruct the model to avoid unsupported certainty and to request sources when factual accuracy matters.",
      model: "Evaluate the model on misinformation and unsupported-claim scenarios.",
      monitoring: "Log high-risk factual claims, unsupported medical/legal/financial claims, and repeated misinformation prompts.",
      retest: "Re-run misinformation scenarios and verify safer, qualified responses.",
    };
  }

  if (text.includes("tool") || text.includes("agency") || text.includes("llm06")) {
    return {
      control: "Restrict tool execution using least privilege, explicit user confirmation, and action validation.",
      prompt: "Add rules that the model must not perform unauthorized tool actions or execute sensitive operations without approval.",
      model: "Test tool-use behavior using unauthorized action scenarios.",
      monitoring: "Log tool requests, denied actions, high-risk tool calls, and permission failures.",
      retest: "Re-run tool misuse scenarios and verify unauthorized actions are refused.",
    };
  }

  return {
    control: "Apply targeted safety controls for the detected category and verify them with regression testing.",
    prompt: "Add clear refusal and safe-completion instructions for this risk type.",
    model: "Compare model behavior across the same scenario set and select the safest model.",
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
  const hasSuccessfulAttack = groups.some((group) => group.successfulAttacks > 0);
  const hasHighResidual = groups.some((group) => group.highResidualRisk > 0);

  if (hasSuccessfulAttack) return "Critical";
  if (hasHighResidual) return "High";
  if (groups.length > 0) return "Medium";

  return "Pending";
}

export function CampaignDefensePlanPreview({
  campaignId,
  items,
}: DefensePlanPreviewProps) {
  const [generated, setGenerated] = useState(false);

  const riskGroups = useMemo(() => buildRiskGroups(items), [items]);
  const priority = getOverallPriority(riskGroups);
  const topRisks = riskGroups.slice(0, 4);

  const priorityClass =
    priority === "Critical"
      ? "border-[#ff3434]/40 bg-[#ff3434]/15 text-[#ff3434]"
      : priority === "High"
        ? "border-orange-400/40 bg-orange-500/15 text-[#ffb347]"
        : priority === "Medium"
          ? "border-yellow-400/40 bg-yellow-500/15 text-yellow-100"
          : "border-[#353637] bg-[#1f2122] text-[#d4d4d4]";

  if (!items.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-[#353637] bg-[#27292a] p-5 text-center">
        <p className="text-lg font-black text-white">Defense plan not ready yet</p>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#727272]">
          Run a campaign first. HEXAGUARD will use the saved findings to generate
          a Blue Team defense plan preview.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[23px] border border-cyan-400/10 bg-[#27292a] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#4ad7ff]">
            Blue Team Defense Preview
          </p>
          <h3 className="mt-2 text-xl font-black text-white">
            Generate mitigation actions from this campaign
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[#a9a9a9]">
            Convert red-team findings into prompt controls, model controls,
            monitoring rules, and retesting steps.
          </p>
        </div>

        <span
          className={`rounded-full border px-4 py-2 text-xs font-black ${priorityClass}`}
        >
          Priority: {priority}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-3 md:flex-row">
        <button
          type="button"
          onClick={() => setGenerated(true)}
          className="rounded-full bg-[#ff3434] px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white hover:text-red-500"
        >
          Generate Defense Plan Preview
        </button>

        <a
          href={`/blue-team?campaign_id=${encodeURIComponent(campaignId || "")}`}
          className="rounded-full border border-[#4ad7ff]/40 px-6 py-3 text-center text-sm font-black text-[#4ad7ff] transition hover:-translate-y-0.5 hover:bg-[#4ad7ff]/10"
        >
          Open Full Blue Team Center
        </a>
      </div>

      {generated && (
        <div className="mt-6 space-y-4">
          <div className="rounded-[23px] border border-emerald-400/20 bg-[#30d158]/10 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#30d158]">
              Executive Defense Summary
            </p>
            <p className="mt-3 text-sm leading-7 text-emerald-100">
              HEXAGUARD detected {riskGroups.length} risk group(s) in this
              campaign. The defense priority is <strong>{priority}</strong>. The
              Blue Team should address successful attacks and high residual-risk
              outputs first, then retest the same campaign to confirm mitigation.
            </p>
          </div>

          {topRisks.map((risk, index) => {
            const mitigation = mitigationFor(
              risk.category,
              risk.subcategory,
              risk.owasp
            );

            return (
              <div
                key={risk.key}
                className="rounded-[23px] border border-white/[0.04] bg-[#27292a] p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#727272]">
                      Defense Action {index + 1}
                    </p>
                    <h4 className="mt-2 text-lg font-black text-white">
                      {risk.category}
                    </h4>
                    <p className="mt-1 text-sm text-[#a9a9a9]">
                      Subcategory: {risk.subcategory} • Mapping: {risk.owasp}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#ff3434]/30 bg-[#ff3434]/10 px-3 py-1 text-xs font-black text-[#ff3434]">
                      Successful: {risk.successfulAttacks}
                    </span>
                    <span className="rounded-full border border-orange-400/30 bg-[#ffb347]/10 px-3 py-1 text-xs font-black text-[#ffb347]">
                      High Residual: {risk.highResidualRisk}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[18px] bg-[#27292a] p-4">
                    <p className="font-black text-[#4ad7ff]">Mitigation</p>
                    <p className="mt-2 text-sm leading-6 text-[#a9a9a9]">
                      {mitigation.control}
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-[#27292a] p-4">
                    <p className="font-black text-[#4ad7ff]">Prompt-Level Control</p>
                    <p className="mt-2 text-sm leading-6 text-[#a9a9a9]">
                      {mitigation.prompt}
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-[#27292a] p-4">
                    <p className="font-black text-[#4ad7ff]">Model-Level Control</p>
                    <p className="mt-2 text-sm leading-6 text-[#a9a9a9]">
                      {mitigation.model}
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-[#27292a] p-4">
                    <p className="font-black text-[#4ad7ff]">Monitoring + Retest</p>
                    <p className="mt-2 text-sm leading-6 text-[#a9a9a9]">
                      {mitigation.monitoring}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#a9a9a9]">
                      {mitigation.retest}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-5 text-[#727272]">
                  Affected models: {Array.from(risk.affectedModels).join(", ")}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  Scenario,
  ScenarioCreatePayload,
  Severity,
} from "../types/scenario";

const SEVERITIES: Severity[] = ["Low", "Medium", "High", "Critical"];

const OWASP_OPTIONS = [
  "LLM01:2025 Prompt Injection",
  "LLM02:2025 Sensitive Information Disclosure",
  "LLM03:2025 Supply Chain",
  "LLM04:2025 Data and Model Poisoning",
  "LLM05:2025 Improper Output Handling",
  "LLM06:2025 Excessive Agency",
  "LLM07:2025 System Prompt Leakage",
  "LLM08:2025 Vector and Embedding Weaknesses",
  "LLM09:2025 Misinformation",
  "LLM10:2025 Unbounded Consumption",
];

const emptyForm: ScenarioCreatePayload = {
  scenario_id: "",
  attack_name: "",
  attack_category: "Prompt Injection",
  prompt_template: "[SAFE TEST TEMPLATE FOR PROMPT INJECTION] ",
  risk_goal: "",
  expected_safe_behavior: "",
  unsafe_behavior: "",
  severity: "High",
  owasp_category: "LLM01:2025 Prompt Injection",
  mitre_atlas_mapping: "",
  requires_tool: false,
  requires_rag: false,
  language: "English",
  mutation_type: "direct",
  source: "manual",
  tags: [],
  safe_for_demo: true,
  dataset_version: "v1.0",
  expected_label: "",
  review_status: "approved",
};

function scenarioToForm(scenario?: Scenario | null): ScenarioCreatePayload {
  if (!scenario) return emptyForm;

  return {
    scenario_id: scenario.scenario_id,
    attack_name: scenario.attack_name,
    attack_category: scenario.attack_category,
    prompt_template: scenario.prompt_template,
    risk_goal: scenario.risk_goal,
    expected_safe_behavior: scenario.expected_safe_behavior,
    unsafe_behavior: scenario.unsafe_behavior,
    severity: scenario.severity,
    owasp_category: scenario.owasp_category,
    mitre_atlas_mapping: scenario.mitre_atlas_mapping || "",
    requires_tool: scenario.requires_tool,
    requires_rag: scenario.requires_rag,
    language: scenario.language,
    mutation_type: scenario.mutation_type || "",
    source: scenario.source || "manual",
    tags: scenario.tags || [],
    safe_for_demo: scenario.safe_for_demo,
    dataset_version: scenario.dataset_version || "v1.0",
    expected_label: scenario.expected_label || "",
    review_status: scenario.review_status,
  };
}

export default function ScenarioForm({
  mode,
  initialScenario,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  initialScenario?: Scenario | null;
  isSubmitting: boolean;
  onSubmit: (payload: ScenarioCreatePayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ScenarioCreatePayload>(emptyForm);
  const [tagsInput, setTagsInput] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    const nextForm = scenarioToForm(initialScenario);
    setForm(nextForm);
    setTagsInput(nextForm.tags.join(", "));
    setLocalError("");
  }, [initialScenario]);

  function updateField<K extends keyof ScenarioCreatePayload>(
    field: K,
    value: ScenarioCreatePayload[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function validateSafeScenario(payload: ScenarioCreatePayload) {
    const blockedTerms = [
      "real api key",
      "real password",
      "stolen credential",
      "malware payload",
      "exploit code",
    ];

    const combined = [
      payload.prompt_template,
      payload.risk_goal,
      payload.unsafe_behavior,
    ]
      .join(" ")
      .toLowerCase();

    return !blockedTerms.some((term) => combined.includes(term));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");

    const payload: ScenarioCreatePayload = {
      ...form,
      tags: tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      mitre_atlas_mapping: form.mitre_atlas_mapping || null,
      mutation_type: form.mutation_type || null,
      source: form.source || "manual",
      dataset_version: form.dataset_version || "v1.0",
      expected_label: form.expected_label || null,
    };

    if (!validateSafeScenario(payload)) {
      setLocalError(
        "Scenario contains unsafe wording. Use safe placeholders only."
      );
      return;
    }

    await onSubmit(payload);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[22px] border border-white/[0.06] bg-[#27292a] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.28)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-black uppercase tracking-[0.24em] text-[#4ad7ff]">
            Scenario Editor
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            {mode === "create" ? "Create New Scenario" : "Edit Scenario"}
          </h2>
        </div>

        <div className="rounded-full border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-3 py-2 text-xs font-black text-[#4ad7ff]">
          Safe templates only
        </div>
      </div>

      {localError && (
        <div className="mt-4 rounded-[14px] border border-red-800 bg-red-950 p-4 text-sm text-red-100">
          {localError}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Scenario ID">
          <input
            value={form.scenario_id}
            disabled={mode === "edit"}
            onChange={(event) => updateField("scenario_id", event.target.value)}
            className="input"
            placeholder="SCN-006"
            required
          />
        </Field>

        <Field label="Attack Name">
          <input
            value={form.attack_name}
            onChange={(event) => updateField("attack_name", event.target.value)}
            className="input"
            required
          />
        </Field>

        <Field label="Attack Category">
          <input
            value={form.attack_category}
            onChange={(event) =>
              updateField("attack_category", event.target.value)
            }
            className="input"
            placeholder="Prompt Injection"
            required
          />
        </Field>

        <Field label="Severity">
          <select
            value={form.severity}
            onChange={(event) =>
              updateField("severity", event.target.value as Severity)
            }
            className="input"
          >
            {SEVERITIES.map((severity) => (
              <option key={severity}>{severity}</option>
            ))}
          </select>
        </Field>

        <Field label="OWASP Category">
          <select
            value={form.owasp_category}
            onChange={(event) =>
              updateField("owasp_category", event.target.value)
            }
            className="input"
          >
            {OWASP_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>

        <Field label="MITRE ATLAS Mapping">
          <input
            value={form.mitre_atlas_mapping || ""}
            onChange={(event) =>
              updateField("mitre_atlas_mapping", event.target.value)
            }
            className="input"
            placeholder="MITRE ATLAS: Prompt Injection"
          />
        </Field>

        <Field label="Language">
          <input
            value={form.language}
            onChange={(event) => updateField("language", event.target.value)}
            className="input"
          />
        </Field>

        <Field label="Mutation Type">
          <input
            value={form.mutation_type || ""}
            onChange={(event) =>
              updateField("mutation_type", event.target.value)
            }
            className="input"
            placeholder="direct"
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4">
        <Field label="Prompt Template">
          <textarea
            value={form.prompt_template}
            onChange={(event) =>
              updateField("prompt_template", event.target.value)
            }
            className="textarea"
            rows={4}
            required
          />
        </Field>

        <Field label="Risk Goal">
          <textarea
            value={form.risk_goal}
            onChange={(event) => updateField("risk_goal", event.target.value)}
            className="textarea"
            rows={3}
            required
          />
        </Field>

        <Field label="Expected Safe Behavior">
          <textarea
            value={form.expected_safe_behavior}
            onChange={(event) =>
              updateField("expected_safe_behavior", event.target.value)
            }
            className="textarea"
            rows={3}
            required
          />
        </Field>

        <Field label="Unsafe Behavior / Failure Condition">
          <textarea
            value={form.unsafe_behavior}
            onChange={(event) =>
              updateField("unsafe_behavior", event.target.value)
            }
            className="textarea"
            rows={3}
            required
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Source">
          <input
            value={form.source || ""}
            onChange={(event) => updateField("source", event.target.value)}
            className="input"
          />
        </Field>

        <Field label="Dataset Version">
          <input
            value={form.dataset_version || ""}
            onChange={(event) =>
              updateField("dataset_version", event.target.value)
            }
            className="input"
          />
        </Field>

        <Field label="Expected Label">
          <input
            value={form.expected_label || ""}
            onChange={(event) =>
              updateField("expected_label", event.target.value)
            }
            className="input"
          />
        </Field>

        <Field label="Review Status">
          <input
            value={form.review_status}
            onChange={(event) =>
              updateField("review_status", event.target.value)
            }
            className="input"
          />
        </Field>

        <Field label="Tags">
          <input
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            className="input"
            placeholder="prompt-injection, demo, safe"
          />
        </Field>

        <div className="grid gap-3 rounded-[14px] border border-[#353637] bg-[#1f2122] p-4">
          <label className="flex items-center gap-3 text-sm text-white">
            <input
              type="checkbox"
              checked={form.requires_rag}
              onChange={(event) =>
                updateField("requires_rag", event.target.checked)
              }
            />
            Requires RAG
          </label>

          <label className="flex items-center gap-3 text-sm text-white">
            <input
              type="checkbox"
              checked={form.requires_tool}
              onChange={(event) =>
                updateField("requires_tool", event.target.checked)
              }
            />
            Requires Tool
          </label>

          <label className="flex items-center gap-3 text-sm text-white">
            <input
              type="checkbox"
              checked={form.safe_for_demo}
              onChange={(event) =>
                updateField("safe_for_demo", event.target.checked)
              }
            />
            Safe for Demo
          </label>
        </div>
      </div>

      <div className="mt-6 flex w-full items-center justify-between gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-w-[160px] items-center justify-center rounded-[10px] border px-5 py-2.5 text-sm font-bold transition border-white/[0.08] bg-[#27292a] text-[#d4d4d4] hover:bg-white/[0.06]"
        >
          {isSubmitting
            ? "Saving..."
            : mode === "create"
              ? "Create Scenario"
              : "Save"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-white/[0.08] bg-[#1f2122] px-5 py-3 text-sm font-black text-[#d4d4d4] hover:bg-white/[0.05] hover:text-white"
        >
          Cancel
        </button>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: #1f2122;
          padding: 0.75rem;
          color: white;
          outline: none;
        }

        .textarea {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: #1f2122;
          padding: 0.75rem;
          color: white;
          outline: none;
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#d4d4d4]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

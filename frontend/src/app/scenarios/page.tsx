"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import ErrorState from "../../components/ErrorState";
import LoadingState from "../../components/LoadingState";
import OwaspBadge from "../../components/OwaspBadge";
import ScenarioForm from "../../components/ScenarioForm";
import ScenarioTable from "../../components/ScenarioTable";
import SeverityBadge from "../../components/SeverityBadge";
import {
  createScenario,
  deleteScenario,
  getScenarioFilters,
  listScenarios,
  updateScenario,
} from "../../lib/scenarioApi";
import {
  Scenario,
  ScenarioCreatePayload,
  ScenarioFilters,
  ScenarioUpdatePayload,
} from "../../types/scenario";

const severityOrder = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [filters, setFilters] = useState<ScenarioFilters>({
    categories: [],
    severities: [],
    owasp_categories: [],
  });

  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [owasp, setOwasp] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");

  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const activeFilters = useMemo(
    () => ({
      search: search.trim() || undefined,
      category: category || undefined,
      severity: severity || undefined,
      owasp: owasp || undefined,
      limit: 50,
      offset: 0,
    }),
    [search, category, severity, owasp]
  );

  const visibleScenarios = useMemo(() => {
    if (!reviewStatus) return scenarios;

    return scenarios.filter(
      (scenario) => scenario.review_status.toLowerCase() === reviewStatus.toLowerCase()
    );
  }, [scenarios, reviewStatus]);

  const summary = useMemo(() => {
    const criticalHigh = scenarios.filter(
      (scenario) => scenario.severity === "Critical" || scenario.severity === "High"
    ).length;

    const owaspMapped = scenarios.filter((scenario) => Boolean(scenario.owasp_category)).length;

    const readyToUse = scenarios.filter(
      (scenario) =>
        scenario.safe_for_demo &&
        ["approved", "active", "ready"].some((status) =>
          scenario.review_status.toLowerCase().includes(status)
        )
    ).length;

    const recentlyUpdated = scenarios.filter((scenario) => {
      const updatedAt = new Date(scenario.updated_at).getTime();
      const thirtyDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;

      return Number.isFinite(updatedAt) && updatedAt >= thirtyDaysAgo;
    }).length;

    return {
      criticalHigh,
      owaspMapped,
      readyToUse,
      recentlyUpdated,
    };
  }, [scenarios]);

async function loadScenarios() {
    setIsLoading(true);
    setError("");

    try {
      const [scenarioResponse, filterResponse] = await Promise.all([
        listScenarios(activeFilters),
        getScenarioFilters(),
      ]);

      setScenarios(scenarioResponse.items);
      setTotal(scenarioResponse.total);
      setFilters(filterResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scenarios.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadScenarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

  function openCreateForm() {
    setEditingScenario(null);
    setSelectedScenario(null);
    setIsFormOpen(true);
    setSuccessMessage("");
    setError("");
  }

  function openEditForm(scenario: Scenario) {
    setEditingScenario(scenario);
    setSelectedScenario(null);
    setIsFormOpen(true);
    setSuccessMessage("");
    setError("");
  }

  function closeForm() {
    setEditingScenario(null);
    setIsFormOpen(false);
  }

  async function handleCreate(payload: ScenarioCreatePayload) {
    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const created = await createScenario(payload);
      setSuccessMessage(`Scenario ${created.scenario_id} created successfully.`);
      closeForm();
      await loadScenarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create scenario.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(payload: ScenarioCreatePayload) {
    if (!editingScenario) return;

    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    const updatePayload: ScenarioUpdatePayload = {
      attack_name: payload.attack_name,
      attack_category: payload.attack_category,
      prompt_template: payload.prompt_template,
      risk_goal: payload.risk_goal,
      expected_safe_behavior: payload.expected_safe_behavior,
      unsafe_behavior: payload.unsafe_behavior,
      severity: payload.severity,
      owasp_category: payload.owasp_category,
      mitre_atlas_mapping: payload.mitre_atlas_mapping,
      requires_tool: payload.requires_tool,
      requires_rag: payload.requires_rag,
      language: payload.language,
      mutation_type: payload.mutation_type,
      source: payload.source,
      tags: payload.tags,
      safe_for_demo: payload.safe_for_demo,
      dataset_version: payload.dataset_version,
      expected_label: payload.expected_label,
      review_status: payload.review_status,
    };

    try {
      const updated = await updateScenario(editingScenario.scenario_id, updatePayload);
      setSuccessMessage(`Scenario ${updated.scenario_id} updated successfully.`);
      closeForm();
      await loadScenarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update scenario.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(scenario: Scenario) {
    const confirmed = window.confirm(
      `Delete scenario ${scenario.scenario_id}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setSuccessMessage("");

    try {
      await deleteScenario(scenario.scenario_id);
      setSuccessMessage(`Scenario ${scenario.scenario_id} deleted successfully.`);

      if (selectedScenario?.scenario_id === scenario.scenario_id) {
        setSelectedScenario(null);
      }

      await loadScenarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete scenario.");
    }
  }

  async function handleUseScenario(scenario: Scenario) {
    setSelectedScenario(scenario);
    setSuccessMessage("");

    try {
      await navigator.clipboard.writeText(scenario.prompt_template);
      setSuccessMessage(`Prompt template copied from ${scenario.scenario_id}.`);
    } catch {
      setSuccessMessage(`${scenario.scenario_id} selected for reuse.`);
    }
  }

  function clearFilters() {
    setSearch("");
    setCategory("");
    setSeverity("");
    setOwasp("");
    setReviewStatus("");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1f2122] px-3 py-6 text-white sm:px-6 xl:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_6%,rgba(255,52,52,.14),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(74,215,255,.10),transparent_32%),linear-gradient(135deg,#191b1c,#1f2122)]" />
      <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-4 rounded-[24px] border border-white/[0.04] bg-[#27292a]/95 p-4 shadow-[0_20px_56px_rgba(0,0,0,0.28)] md:p-5">

        <section className="rounded-[20px] border border-white/[0.05] bg-[#17191a] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-[#4ad7ff]">
                AI Threat Scenario Database
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white md:text-2xl">
                Attack Scenario Library
              </h1>

              <p className="mt-2 text-sm leading-6 text-[#d4d4d4] max-w-[560px]">
            Manage reusable red teaming scenarios, attack prompts, risk categories, OWASP mappings, safe behavior expectations, and test templates.
          </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled
                title="Import Scenarios is coming soon."
                className="rounded-full border border-white/[0.08] bg-[#1f2122] px-3 py-2 text-xs font-black text-[#727272] opacity-75"
              >
                Import
              </button>

              <button
                type="button"
                onClick={openCreateForm}
                className="rounded-[12px] bg-[#ff3434] px-3 py-2 text-xs font-black text-white shadow-[0_0_16px_rgba(255,52,52,0.22)] transition hover:bg-[#ff4545]"
              >
                + New Scenario
              </button>
            </div>
          </div>

          <div className="mt-4 grid auto-rows-fr gap-4 border-t border-white/[0.06] pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <LibraryOverviewMetric
              label="Total Scenarios"
              value={String(total)}
              tone="cyan"
            />

            <LibraryOverviewMetric
              label="High-Risk Scenarios"
              value={String(summary.criticalHigh)}
              tone="red"
            />

            <LibraryOverviewMetric
              label="OWASP-Mapped"
              value={String(summary.owaspMapped)}
              tone="cyan"
            />

            <LibraryOverviewMetric
              label="Ready to Use"
              value={String(summary.readyToUse)}
              tone="green"
            />
          </div>
        </section>

<section className="rounded-[12px] border border-white/[0.05] bg-[#1f2122]/95 p-2.5 shadow-[0_10px_26px_rgba(0,0,0,0.14)]">
          <div className="grid gap-2 xl:grid-cols-[minmax(360px,1.35fr)_minmax(560px,1.9fr)_auto] xl:items-center">
            <label className="flex h-9 min-w-[300px] items-center gap-3 rounded-[12px] border border-white/[0.07] bg-[#27292a] px-3">
              <span className="text-sm text-[#727272]">⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full border-0 bg-transparent text-sm text-white outline-none placeholder:text-[#727272]"
                placeholder="Search scenarios, prompts, OWASP mappings..."
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <FilterSelect value={category} onChange={setCategory}>
                <option value="">All categories</option>
                {filters.categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect value={severity} onChange={setSeverity}>
                <option value="">All severities</option>
                {filters.severities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect value={owasp} onChange={setOwasp}>
                <option value="">All OWASP</option>
                {filters.owasp_categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect value={reviewStatus} onChange={setReviewStatus}>
                <option value="">All statuses</option>
                {unique(scenarios.map((scenario) => scenario.review_status)).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FilterSelect>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="h-9 rounded-[12px] border border-white/[0.08] bg-[#27292a] px-3 text-xs font-black text-[#a9a9a9] transition hover:bg-white/[0.05] hover:text-white"
            >
              Clear
            </button>
          </div>
        </section>

{successMessage && (
          <div className="rounded-[18px] border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm font-semibold text-[#30d158]">
            {successMessage}
          </div>
        )}

        {error && <ErrorState message={error} />}

        {isLoading ? (
          <LoadingState message="Loading attack scenario library..." />
        ) : (
          <ScenarioTable
            scenarios={visibleScenarios}
            onView={setSelectedScenario}
            onUse={handleUseScenario}
            onEdit={openEditForm}
            onDelete={handleDelete}
          />
        )}

        {selectedScenario && (
          <ScenarioDetailsPanel
            scenario={selectedScenario}
            onUse={handleUseScenario}
            onEdit={openEditForm}
            onClose={() => setSelectedScenario(null)}
          />
        )}

        {isFormOpen && (
          <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/55 px-4 py-6 backdrop-blur-sm">
            <div className="max-h-[80vh] w-full max-w-[760px] overflow-y-auto rounded-[18px] border border-white/[0.10] bg-[#1f2122] shadow-[0_26px_70px_rgba(0,0,0,0.55)]">
              <ScenarioForm
                mode={editingScenario ? "edit" : "create"}
                initialScenario={editingScenario}
                isSubmitting={isSubmitting}
                onSubmit={editingScenario ? handleUpdate : handleCreate}
                onCancel={closeForm}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function LibraryOverviewMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "red" | "green" | "cyan" | "neutral";
}) {
  return (
    <article className="flex h-[108px] flex-col items-center justify-center rounded-[20px] border border-white/[0.07] bg-[#27292a]/90 px-5 py-4 text-center shadow-[0_12px_30px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="text-[10px] font-black uppercase leading-none tracking-[0.18em] text-[#a9a9a9]">
        {label}
      </p>

      <p className={`mt-4 font-mono text-[30px] font-black leading-none tracking-[-0.04em] ${toneTextClass(tone)}`}>
        {value}
      </p>
    </article>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "red" | "green" | "cyan" | "neutral";
}) {
  return (
    <article className="rounded-[18px] border border-white/[0.05] bg-[#1f2122] p-4 text-center shadow-[0_10px_26px_rgba(0,0,0,0.14)]">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">
        {label}
      </p>
      <p className={`mt-2 font-mono text-xl font-black ${toneTextClass(tone)}`}>
        {value}
      </p>
    </article>
  );
}

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 min-w-[135px] rounded-[12px] border border-white/[0.07] bg-[#27292a] px-3 text-xs font-bold text-white outline-none"
    >
      {children}
    </select>
  );
}




function ScenarioDetailsPanel({
  scenario,
  onUse,
  onEdit,
  onClose,
}: {
  scenario: Scenario;
  onUse: (scenario: Scenario) => void;
  onEdit: (scenario: Scenario) => void;
  onClose: () => void;
}) {
  const tags = scenario.tags.length > 0 ? scenario.tags : ["No tags"];

  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/55 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[18px] border border-white/[0.10] bg-[#1f2122] shadow-[0_26px_70px_rgba(0,0,0,0.55)]">
        <div className="shrink-0 border-b border-white/[0.07] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs font-black uppercase tracking-[0.20em] text-[#4ad7ff]">
                {scenario.scenario_id}
              </p>

              <h2 className="mt-2 text-2xl font-black leading-tight tracking-[-0.04em] text-white">
                {scenario.attack_name}
              </h2>

              <div className="mt-3 flex flex-wrap gap-2">
                <SeverityBadge severity={scenario.severity} />
                <OwaspBadge value={scenario.owasp_category} />
                <StatusBadge value={scenario.review_status} />
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-w-[155px] items-center justify-center rounded-[10px] border px-5 py-2.5 text-sm font-bold transition border-white/[0.08] bg-[#27292a] text-[#d4d4d4] hover:bg-white/[0.06]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 pb-6">
          <DetailBox title="Description / Risk Goal">
            {scenario.risk_goal}
          </DetailBox>

          <DetailBox title="Prompt Template">
            {scenario.prompt_template}
          </DetailBox>

          <DetailBox title="Expected Safe Behavior">
            {scenario.expected_safe_behavior}
          </DetailBox>

          <DetailBox title="Failure Condition / Unsafe Behavior">
            {scenario.unsafe_behavior}
          </DetailBox>

          <ScenarioMetadataTable
            rows={[
              { label: "Category", value: scenario.attack_category },
              { label: "Language", value: scenario.language },
              { label: "Mutation", value: scenario.mutation_type || "None" },
              { label: "Source", value: scenario.source || "manual" },
              { label: "Requires RAG", value: scenario.requires_rag ? "Yes" : "No" },
              { label: "Requires Tool", value: scenario.requires_tool ? "Yes" : "No" },
              { label: "MITRE ATLAS", value: scenario.mitre_atlas_mapping || "Not specified" },
              { label: "Dataset Version", value: scenario.dataset_version || "Not specified" },
            ]}
          />

          <div className="rounded-[14px] border border-white/[0.08] bg-[#27292a] p-4">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-white">
              Tags
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/[0.08] bg-[#1f2122] px-2.5 py-1 font-mono text-[11px] font-bold text-[#a9a9a9]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/[0.07] bg-[#1f2122] px-4 py-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onUse(scenario)}
              className="inline-flex min-w-[150px] items-center justify-center rounded-[10px] border border-[#ff3434]/70 bg-[#ff3434] px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_16px_rgba(255,52,52,0.18)] transition hover:bg-[#ff4545]"
            >
              Use in Manual
            </button>

            <button
              type="button"
              disabled
              title="Campaign linking will be connected later."
              className="inline-flex min-w-[150px] items-center justify-center rounded-[10px] border border-white/[0.08] bg-[#27292a] px-5 py-2.5 text-sm font-bold text-[#727272] opacity-70"
            >
              Add to Campaign
            </button>

            <button
              type="button"
              onClick={() => onEdit(scenario)}
              className="inline-flex min-w-[150px] items-center justify-center rounded-[10px] border border-white/[0.08] bg-[#27292a] px-5 py-2.5 text-sm font-bold text-[#d4d4d4] transition hover:bg-white/[0.06]"
            >
              Edit Scenario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function DetailBox({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-white/[0.08] bg-[#27292a] p-4">
      <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#a9a9a9]">
        {title}
      </p>

      <div className="mt-2 text-sm leading-6 text-[#d4d4d4]">
        {children}
      </div>
    </section>
  );
}

function ScenarioMetadataTable({
  rows,
}: {
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#27292a]">
      <div className="border-b border-white/[0.07] px-4 py-3">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-white">
          Scenario Metadata
        </p>
      </div>

      <table className="w-full table-auto border-collapse text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-white/[0.045] last:border-b-0">
              <th className="w-[1%] whitespace-nowrap px-4 py-2.5 pr-3 text-left align-top font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[#727272]">
                {row.label}
              </th>

              <td className="px-4 py-2.5 pl-2 align-top font-semibold leading-5 text-[#d4d4d4]">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DetailMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-3 text-sm leading-5">
      <span className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[#727272]">
        {label}
      </span>

      <span className="min-w-0 break-words font-semibold text-[#d4d4d4]">
        {value}
      </span>
    </div>
  );
}


function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();

  const className =
    normalized.includes("approved") || normalized.includes("active")
      ? "border-emerald-400/25 bg-emerald-500/10 text-[#30d158]"
      : normalized.includes("draft")
        ? "border-white/[0.08] bg-[#27292a] text-[#a9a9a9]"
        : "border-[#ffb347]/25 bg-[#ffb347]/10 text-[#ffb347]";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-black ${className}`}>
      {value}
    </span>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function toneTextClass(tone: "red" | "green" | "cyan" | "neutral") {
  return {
    red: "text-[#ff3434]",
    green: "text-[#30d158]",
    cyan: "text-[#4ad7ff]",
    neutral: "text-white",
  }[tone];
}

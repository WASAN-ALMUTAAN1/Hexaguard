"use client";

import { CampaignDefenseWorkspace } from "@/components/blue-team/CampaignDefenseWorkspace";

import { useEffect, useMemo, useState } from "react";
import ErrorState from "../../components/ErrorState";
import LoadingState from "../../components/LoadingState";
import {
  analyzeBlueTeamRecommendation,
  getBlueTeamRecommendations,
} from "../../lib/blueTeamApi";
import {
  BlueTeamAgentAnalysisResponse,
  BlueTeamRecommendation,
  BlueTeamRecommendationResponse,
} from "../../types/blueTeam";

const priorityStyles: Record<string, string> = {
  Critical: "border-red-500/40 bg-[#ff3434]/10 text-[#ff3434]",
  High: "border-orange-500/40 bg-[#ffb347]/10 text-[#ffb347]",
  Medium: "border-yellow-500/40 bg-[#ffd166]/10 text-[#ffd166]",
  Low: "border-emerald-500/40 bg-[#30d158]/10 text-[#30d158]",
};

export default function BlueTeamPage() {
  const [data, setData] = useState<BlueTeamRecommendationResponse | null>(null);
  const [agentResult, setAgentResult] =
    useState<BlueTeamAgentAnalysisResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isAgentRunning, setIsAgentRunning] = useState(false);

  const [error, setError] = useState("");
  const [agentError, setAgentError] = useState("");

  const [priorityFilter, setPriorityFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState("");
  const [owaspFilter, setOwaspFilter] = useState("");
  const [search, setSearch] = useState("");

  async function loadRecommendations() {
    setIsLoading(true);
    setError("");

    try {
      const response = await getBlueTeamRecommendations();
      setData(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load Blue Team recommendations."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function runAgentAnalysis(item: BlueTeamRecommendation) {
    setIsAgentRunning(true);
    setAgentError("");
    setAgentResult(null);

    try {
      const response = await analyzeBlueTeamRecommendation({
        owasp_category: item.owasp_category,
        analysis_mode: "defensive",
        include_executive_summary: true,
      });

      setAgentResult(response);
    } catch (err) {
      setAgentError(
        err instanceof Error
          ? err.message
          : "Failed to run Blue Team AI Agent."
      );
    } finally {
      setIsAgentRunning(false);
    }
  }

  useEffect(() => {
    loadRecommendations();
  }, []);

  const filteredRecommendations = useMemo(() => {
    if (!data) return [];

    return data.recommendations.filter((item) => {
      const searchText = [
        item.owasp_category,
        item.attack_category,
        item.priority,
        item.review_status,
        item.recommendation_title,
        item.defense_summary,
        item.evidence_summary,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!priorityFilter || item.priority === priorityFilter) &&
        (!reviewFilter || item.review_status === reviewFilter) &&
        (!owaspFilter || item.owasp_category === owaspFilter) &&
        (!search || searchText.includes(search.toLowerCase()))
      );
    });
  }, [data, priorityFilter, reviewFilter, owaspFilter, search]);

  const owaspOptions = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set(data.recommendations.map((item) => item.owasp_category))
    );
  }, [data]);

  const reviewOptions = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set(data.recommendations.map((item) => item.review_status))
    );
  }, [data]);

  if (isLoading) {
    return (
      <main className="hxg-background min-h-screen p-8 text-white">
        <CampaignDefenseWorkspace />

        <LoadingState message="Loading Blue Team AI Defense Center..." />
      </main>
    );
  }

  if (error) {
    return (
      <main className="hxg-background min-h-screen p-8 text-white">
        <ErrorState message={error} />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="hxg-background min-h-screen p-8 text-white">
        <ErrorState message="No Blue Team data available." />
      </main>
    );
  }

  return (
    <main className="hxg-background min-h-screen p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[23px] border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-[#27292a] p-6 shadow-2xl shadow-cyan-950/30">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-[#4ad7ff]">
                HEXAGUARD Blue Team
              </p>

              <h1 className="mt-3 text-4xl font-black">
                AI Defense Center
              </h1>

              <p className="mt-3 max-w-3xl text-[#d4d4d4]">
                LangGraph-powered defensive AI analysis using Groq, OWASP
                mappings, manual red-team findings, risk scores, and analyst
                verdicts.
              </p>
            </div>

            <button
              onClick={loadRecommendations}
              className="rounded-[18px] border border-[#4ad7ff]/40 bg-[#4ad7ff]/10 px-5 py-3 text-sm font-bold text-[#4ad7ff] hover:bg-cyan-400/20"
            >
              Refresh Defense Data
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Recommendations"
              value={data.total_recommendations}
              accent="cyan"
            />
            <MetricCard
              label="Critical Priority"
              value={data.critical_priority_count}
              accent="red"
            />
            <MetricCard
              label="High Priority"
              value={data.high_priority_count}
              accent="orange"
            />
            <MetricCard
              label="Needs Review"
              value={data.needs_review_count}
              accent="yellow"
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <OwaspDefenseSummary items={data.owasp_summary} />

          <section className="rounded-[23px] border border-[#353637] bg-[#27292a] p-5">
            <h2 className="text-xl font-bold">Defense Filters</h2>

            <div className="mt-5 grid gap-4 lg:grid-cols-4">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="rounded-[14px] border border-[#353637] bg-[#1f2122] p-3 text-white"
                placeholder="Search defense items..."
              />

              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                className="rounded-[14px] border border-[#353637] bg-[#1f2122] p-3 text-white"
              >
                <option value="">All priorities</option>
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>

              <select
                value={reviewFilter}
                onChange={(event) => setReviewFilter(event.target.value)}
                className="rounded-[14px] border border-[#353637] bg-[#1f2122] p-3 text-white"
              >
                <option value="">All review statuses</option>
                {reviewOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <select
                value={owaspFilter}
                onChange={(event) => setOwaspFilter(event.target.value)}
                className="rounded-[14px] border border-[#353637] bg-[#1f2122] p-3 text-white"
              >
                <option value="">All OWASP categories</option>
                {owaspOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setSearch("");
                setPriorityFilter("");
                setReviewFilter("");
                setOwaspFilter("");
              }}
              className="mt-4 rounded-[14px] border border-[#353637] px-4 py-2 text-sm font-bold text-white hover:bg-[#303234]"
            >
              Clear Filters
            </button>
          </section>
        </section>

        {agentError && <ErrorState message={agentError} />}

        {isAgentRunning && (
          <LoadingState message="LangGraph Blue Team AI Agent is analyzing evidence..." />
        )}

        {agentResult && <AgentAnalysisPanel result={agentResult} />}

        <section className="space-y-5">
          {filteredRecommendations.length === 0 ? (
            <div className="rounded-[23px] border border-[#353637] bg-[#27292a] p-8 text-center text-[#a9a9a9]">
              No recommendations match the selected filters.
            </div>
          ) : (
            filteredRecommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.owasp_category}
                item={recommendation}
                onRunAgent={runAgentAnalysis}
              />
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: "cyan" | "red" | "orange" | "yellow";
}) {
  const accentClass = {
    cyan: "border-cyan-500/30",
    red: "border-red-500/30",
    orange: "border-orange-500/30",
    yellow: "border-yellow-500/30",
  }[accent];

  return (
    <div className={`rounded-[18px] border bg-[#1f2122] p-5 ${accentClass}`}>
      <p className="text-xs uppercase tracking-wide text-[#727272]">{label}</p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
        priorityStyles[priority] ||
        "border-slate-500/40 bg-slate-500/10 text-[#d4d4d4]"
      }`}
    >
      {priority}
    </span>
  );
}

function OwaspDefenseSummary({
  items,
}: {
  items: BlueTeamRecommendationResponse["owasp_summary"];
}) {
  return (
    <section className="rounded-[23px] border border-[#353637] bg-[#27292a] p-5">
      <h2 className="text-xl font-bold">OWASP Defense Coverage</h2>
      <p className="mt-1 text-sm text-[#a9a9a9]">
        Recommendations grouped by OWASP category.
      </p>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-[#a9a9a9]">No OWASP findings yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.owasp_category}
              className="rounded-[18px] border border-[#353637] bg-[#1f2122] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold text-[#4ad7ff]">
                  {item.owasp_category}
                </p>
                <PriorityBadge priority={item.highest_priority} />
              </div>

              <p className="mt-2 text-sm text-[#a9a9a9]">
                Related findings: {item.count}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function AgentAnalysisPanel({
  result,
}: {
  result: BlueTeamAgentAnalysisResponse;
}) {
  return (
    <section className="rounded-[23px] border border-violet-500/30 bg-violet-950/20 p-6 shadow-2xl shadow-violet-950/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-violet-300">
            LangGraph AI Defense Agent
          </p>

          <h2 className="mt-2 text-2xl font-black">
            AI Defense Analysis Result
          </h2>

          <p className="mt-2 max-w-4xl text-[#d4d4d4]">
            {result.risk_interpretation}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <PriorityBadge priority={result.priority} />

          <span className="rounded-full border border-cyan-500/40 bg-[#4ad7ff]/10 px-3 py-1 text-xs font-bold text-[#4ad7ff]">
            Source: {result.source}
          </span>

          <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-300">
            Confidence: {result.confidence}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <SmallInfo title="Residual Risk" value={result.residual_risk} />
        <SmallInfo
          title="Human Review"
          value={result.requires_human_review ? "Required" : "Not Required"}
        />
        <SmallInfo title="Guardrail" value={result.guardrail_status} />
      </div>

      <div className="mt-5 rounded-[18px] border border-[#353637] bg-[#1f2122] p-4">
        <h3 className="font-bold text-violet-300">Executive Summary</h3>
        <p className="mt-2 text-sm text-[#d4d4d4]">
          {result.executive_summary || "No executive summary generated."}
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <DefenseChecklist title="AI Defense Plan" items={result.defense_plan} />
        <DefenseChecklist
          title="AI Verification Plan"
          items={result.verification_plan}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <DefenseChecklist title="Evidence Used" items={result.evidence_used} />
        <DefenseChecklist title="Agent Trace" items={result.agent_trace} />
      </div>
    </section>
  );
}

function SmallInfo({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#353637] bg-[#1f2122] p-4">
      <p className="text-xs uppercase tracking-wide text-[#727272]">{title}</p>
      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function RecommendationCard({
  item,
  onRunAgent,
}: {
  item: BlueTeamRecommendation;
  onRunAgent: (item: BlueTeamRecommendation) => void;
}) {
  return (
    <article className="rounded-[23px] border border-[#353637] bg-[#27292a] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-[#4ad7ff]">
            {item.owasp_category}
          </p>

          <h2 className="mt-2 text-2xl font-black">
            {item.recommendation_title}
          </h2>

          <p className="mt-2 max-w-4xl text-[#d4d4d4]">
            {item.defense_summary}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <PriorityBadge priority={item.priority} />

          <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-300">
            {item.review_status}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={() => onRunAgent(item)}
          className="rounded-[14px] bg-violet-500 px-5 py-3 text-sm font-bold text-white hover:bg-violet-400"
        >
          Run AI Defense Agent
        </button>
      </div>

      <div className="mt-5 rounded-[18px] border border-[#353637] bg-[#1f2122] p-4">
        <h3 className="font-bold text-[#4ad7ff]">Evidence Summary</h3>
        <p className="mt-2 text-sm text-[#d4d4d4]">{item.evidence_summary}</p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <DefenseChecklist
          title="Fix Instructions"
          items={item.fix_instructions}
        />

        <DefenseChecklist
          title="Verification Steps"
          items={item.verification_steps}
        />
      </div>

      <div className="mt-5">
        <h3 className="font-bold text-[#4ad7ff]">Related Findings</h3>

        <div className="mt-3 overflow-x-auto rounded-[18px] border border-[#353637]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#1f2122] text-xs uppercase tracking-wide text-[#727272]">
              <tr>
                <th className="px-4 py-3">Run</th>
                <th className="px-4 py-3">Scenario</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Verdict</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800 bg-[#1f2122]/60">
              {item.related_findings.map((finding) => (
                <tr key={finding.run_id}>
                  <td className="px-4 py-3 font-mono text-[#4ad7ff]">
                    #{finding.run_id}
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-bold text-white">
                      {finding.scenario_id || "N/A"}
                    </p>
                    <p className="text-xs text-[#a9a9a9]">
                      {finding.attack_name || "Unknown"}
                    </p>
                  </td>

                  <td className="px-4 py-3 font-mono text-xs text-[#d4d4d4]">
                    {finding.model_name}
                  </td>

                  <td className="px-4 py-3 text-[#d4d4d4]">
                    {finding.severity || "N/A"}
                  </td>

                  <td className="px-4 py-3 text-white">
                    {finding.risk_score ?? "N/A"}
                  </td>

                  <td className="px-4 py-3 text-[#d4d4d4]">
                    {finding.human_verdict || "Unreviewed"}
                  </td>

                  <td className="px-4 py-3 text-[#d4d4d4]">
                    {finding.final_status || "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}

function DefenseChecklist({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-[18px] border border-[#353637] bg-[#1f2122] p-4">
      <h3 className="font-bold text-[#4ad7ff]">{title}</h3>

      <ul className="mt-3 space-y-3">
        {items.length === 0 ? (
          <li className="text-sm text-[#a9a9a9]">No items available.</li>
        ) : (
          items.map((item) => (
            <li key={item} className="flex gap-3 text-sm text-[#d4d4d4]">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
              <span>{item}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

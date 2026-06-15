"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import ErrorState from "@/components/ErrorState";
import LoadingState from "@/components/LoadingState";

import { getMyProfile } from "@/lib/authApi";
import { getBlueTeamRecommendations } from "@/lib/blueTeamApi";
import { getDashboardSummary } from "@/lib/dashboardApi";

import type { AuthUser } from "@/types/auth";
import type {
  BlueTeamRecommendation,
  BlueTeamRecommendationResponse,
} from "@/types/blueTeam";
import type {
  DashboardSummary,
  DistributionItem,
  ModelRiskSummary,
  RecentActivityItem,
} from "@/types/dashboard";

const chartColors = [
  "#ff3434",
  "#ffb347",
  "#ffd166",
  "#4ad7ff",
  "#30d158",
  "#a9a9a9",
];

type RiskTone = "critical" | "high" | "medium" | "low" | "neutral";

export default function HomeDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [blueTeamData, setBlueTeamData] =
    useState<BlueTeamRecommendationResponse | null>(null);
  const [recommendationError, setRecommendationError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setRecommendationError("");

    const [summaryResult, recommendationsResult, profileResult] =
      await Promise.allSettled([
        getDashboardSummary(),
        getBlueTeamRecommendations(),
        getMyProfile(),
      ]);

    if (summaryResult.status === "fulfilled") {
      setSummary(summaryResult.value);
    } else {
      setError(
        summaryResult.reason instanceof Error
          ? summaryResult.reason.message
          : "Failed to load dashboard summary."
      );
    }

    if (recommendationsResult.status === "fulfilled") {
      setBlueTeamData(recommendationsResult.value);
    } else {
      setBlueTeamData(null);
      setRecommendationError(
        recommendationsResult.reason instanceof Error
          ? recommendationsResult.reason.message
          : "Failed to load Blue Team recommendations."
      );
    }

    if (profileResult.status === "fulfilled") {
      setCurrentUser(profileResult.value);
    } else {
      setCurrentUser(null);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const dashboardModel = useMemo(() => {
    if (!summary) return null;

    const criticalFindings = summary.critical_manual_runs;
    const failedTests = summary.failed_attacks;
    const blockedAttempts = calculateBlockedAttempts(summary);
    const averageRiskScore = summary.average_risk_score;
    const riskTone = getRiskTone(averageRiskScore);
    const threatLevel = getRiskLevel(averageRiskScore);

    const reviewQueue = summary.recent_activity.filter((item) => {
      const verdict = (item.human_verdict || "").toLowerCase();
      return !verdict || verdict.includes("pending") || verdict.includes("review");
    }).length;

    const modelRows = [...summary.model_risk_summary].sort(
      (a, b) => b.average_risk_score - a.average_risk_score
    );

    const modelRowsBySafety = [...summary.model_risk_summary].sort(
      (a, b) => a.average_risk_score - b.average_risk_score
    );

    const safestModelItem =
      (summary.safest_model
        ? summary.model_risk_summary.find(
            (model) => model.model_name === summary.safest_model
          )
        : null) ||
      modelRowsBySafety[0] ||
      null;

    const mostVulnerableModelItem =
      (summary.most_vulnerable_model
        ? summary.model_risk_summary.find(
            (model) => model.model_name === summary.most_vulnerable_model
          )
        : null) ||
      modelRows[0] ||
      null;

    const topAttackVector =
      [...summary.owasp_distribution].sort((a, b) => b.count - a.count)[0]
        ?.label || "No attack vector data";

    const recentFindings = [...summary.recent_activity]
      .sort((a, b) => {
        const riskDiff = (b.risk_score ?? 0) - (a.risk_score ?? 0);

        if (riskDiff !== 0) {
          return riskDiff;
        }

        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      })
      .slice(0, 8);

    return {
      criticalFindings,
      failedTests,
      blockedAttempts,
      averageRiskScore,
      riskTone,
      threatLevel,
      reviewQueue,
      safestModel: safestModelItem?.model_name || null,
      safestModelRisk: safestModelItem?.average_risk_score ?? null,
      mostVulnerableModel: mostVulnerableModelItem?.model_name || null,
      mostVulnerableModelRisk:
        mostVulnerableModelItem?.average_risk_score ?? null,
      topAttackVector,
      modelRows,
      recentFindings,
    };
  }, [summary]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#1f2122]">
        <LoadingState message="Loading HEXAGUARD Home Dashboard..." />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#1f2122]">
        <ErrorState message={error} />
      </main>
    );
  }

  if (!summary || !dashboardModel) {
    return (
      <main className="min-h-screen bg-[#1f2122]">
        <ErrorState message="No dashboard data available." />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1f2122] px-4 py-6 text-white sm:px-6 xl:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_6%,rgba(255,52,52,.16),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(74,215,255,.11),transparent_32%),linear-gradient(135deg,#191b1c,#1f2122)]" />
      <div className="pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative mx-auto flex w-full max-w-[1220px] flex-col gap-8 rounded-[23px] border border-white/[0.04] bg-[#27292a]/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,.24)] md:p-8">
        <DashboardCommandHeader
          threatLevel={dashboardModel.threatLevel}
          riskTone={dashboardModel.riskTone}
          user={currentUser}
        />

        <HeroSection
          totalScans={summary.total_manual_runs}
          criticalFindings={dashboardModel.criticalFindings}
          failedTests={dashboardModel.failedTests}
          reviewQueue={dashboardModel.reviewQueue}
        />

        <SectionHeading
          title="Main KPI Cards"
          description="The most important backend dashboard values are shown first for fast security review."
        />

        <section className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total Scans"
            value={summary.total_manual_runs}
            subtitle="Total manual AI security tests stored by the backend"
            tone="cyan"
          />

          <MetricCard
            label="Critical Findings"
            value={dashboardModel.criticalFindings}
            subtitle="Critical manual red team findings from dashboard summary"
            tone={dashboardModel.criticalFindings > 0 ? "critical" : "low"}
          />

          <MetricCard
            label="Failed Tests"
            value={dashboardModel.failedTests}
            subtitle="Failed or vulnerable tests from dashboard summary"
            tone={dashboardModel.failedTests > 0 ? "high" : "low"}
          />

          <MetricCard
            label="Review Queue"
            value={dashboardModel.reviewQueue}
            subtitle="Recent activity items waiting for analyst review"
            tone={dashboardModel.reviewQueue > 0 ? "medium" : "low"}
          />
        </section>

        <SectionHeading
          title="AI Security Overview"
          description="A unified backend-based view of model safety, vulnerability, top attack vector, and platform risk."
        />

        <section className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Safest Model"
            value={dashboardModel.safestModel || "No model data"}
            subtitle={
              dashboardModel.safestModelRisk !== null
                ? `Lowest backend risk score: ${formatPercent(
                    dashboardModel.safestModelRisk
                  )}`
                : "No model comparison data from backend"
            }
            tone="low"
            compact
          />

          <MetricCard
            label="Most Vulnerable Model"
            value={dashboardModel.mostVulnerableModel || "No model data"}
            subtitle={
              dashboardModel.mostVulnerableModelRisk !== null
                ? `Highest backend risk exposure: ${formatPercent(
                    dashboardModel.mostVulnerableModelRisk
                  )}`
                : "No model comparison data from backend"
            }
            tone={
              dashboardModel.mostVulnerableModelRisk !== null
                ? getRiskTone(dashboardModel.mostVulnerableModelRisk)
                : "neutral"
            }
            compact
          />

          <MetricCard
            label="Top Attack Vector"
            value={dashboardModel.topAttackVector}
            subtitle="Most frequent OWASP category from backend distribution"
            tone="cyan"
            compact
          />

          <MetricCard
            label="Average Risk Score"
            value={formatPercent(dashboardModel.averageRiskScore)}
            subtitle="Overall backend risk percentage"
            tone={dashboardModel.riskTone}
          />
        </section>

        <section className="grid items-stretch gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <DashboardPanel
            title="Risk & Exploit Trend"
            description="Timeline view from recent backend activity, with summary totals kept consistent with the dashboard API."
          >
            <RiskTrend
              activity={summary.recent_activity}
              totalFailed={dashboardModel.failedTests}
              totalCritical={dashboardModel.criticalFindings}
              totalBlocked={dashboardModel.blockedAttempts}
            />
          </DashboardPanel>

          <DashboardPanel
            title="Attack Vector Distribution"
            description="Most common OWASP AI attack categories recorded by the backend."
          >
            <AttackVectorDistribution items={summary.owasp_distribution} />
          </DashboardPanel>
        </section>

        <DashboardPanel
          title="Multi-Model Security Matrix"
          description="Comparison of tested AI models using real backend model risk summary fields."
        >
          <MultiModelMatrix
            models={dashboardModel.modelRows}
            safestModelName={dashboardModel.safestModel}
          />
        </DashboardPanel>

        <DashboardPanel
          title="Recent High-Risk Findings"
          description="Latest saved manual red team activity ordered by risk severity and time."
        >
          <RecentFindings activity={dashboardModel.recentFindings} />
        </DashboardPanel>

        <DashboardPanel
          title="Blue Team Recommendations"
          description="Defensive recommendations loaded from the backend Blue Team recommendations API."
        >
          <BlueTeamRecommendations
            recommendations={blueTeamData?.recommendations || []}
            apiError={recommendationError}
          />
        </DashboardPanel>
      </div>
    </main>
  );
}

function DashboardCommandHeader({
  threatLevel,
  riskTone,
  user,
}: {
  threatLevel: string;
  riskTone: RiskTone;
  user: AuthUser | null;
}) {
  const roleLabel = formatUserRole(user?.role);
  const userName = getDashboardUserName(user);
  const userChipLabel = user?.role === "admin" ? "Admin" : "User";

  return (
    <section className="rounded-[20px] border border-white/[0.055] bg-[#1f2122]/95 px-5 py-4 shadow-[0_14px_34px_rgba(0,0,0,.22)]">
      <div className="flex flex-wrap items-center justify-center gap-2.5 text-center">
        <div className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-[#27292a] px-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#727272]">
            Home Dashboard
          </span>
          <span className="h-4 w-px bg-white/[0.10]" />
          <strong className="text-sm font-black tracking-[-0.02em] text-white">
            Security Overview
          </strong>
        </div>

        <HeaderStatChip label={userChipLabel} value={userName} tone="neutral" />
        <HeaderStatChip label="Role" value={roleLabel} tone="cyan" />
        <HeaderStatChip
          label="Status"
          value={user?.status ? formatUserStatus(user.status) : "Active"}
          tone="low"
        />
      </div>
    </section>
  );
}

function getDashboardUserName(user: AuthUser | null) {
  const fullName = user?.full_name?.trim();

  if (fullName) {
    return fullName.split(/\s+/)[0];
  }

  return user?.email?.split("@")[0] || "User";
}

function formatUserStatus(status?: string | null) {
  const statusMap: Record<string, string> = {
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
  };

  if (!status) {
    return "Active";
  }

  return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

function formatUserRole(role?: string | null) {
  const roleMap: Record<string, string> = {
    admin: "Admin",
    security_engineer: "Security Engineer",
    ai_engineer: "AI Engineer",
    forward_deployed_engineer: "FDE",
    viewer: "Viewer",
  };

  if (!role) {
    return "User";
  }

  return (
    roleMap[role] ||
    role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

function HeaderStatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: RiskTone | "cyan";
}) {
  return (
    <span className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-[#27292a] px-4 text-xs font-semibold text-[#a9a9a9]">
      <span className="text-[#727272]">{label}</span>
      <strong className={riskValueClass(tone)}>{value}</strong>
    </span>
  );
}

function HeroSection({
  totalScans,
  criticalFindings,
  failedTests,
  reviewQueue,
}: {
  totalScans: number;
  criticalFindings: number;
  failedTests: number;
  reviewQueue: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[23px] bg-[#17191a] p-8 text-center shadow-[0_12px_32px_rgba(0,0,0,.16)] md:p-12">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(74,215,255,.22),transparent_32%),radial-gradient(circle_at_92%_85%,rgba(255,52,52,.20),transparent_30%)]" />

      <div className="relative mx-auto max-w-[940px]">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#ff3434]/35 bg-[#ff3434]/15 px-4 py-2 text-xs font-semibold text-white">
          AI Security Operations Dashboard
        </span>

        <h1 className="mt-5 text-4xl font-extrabold uppercase leading-[1.03] tracking-[-2px] text-white md:text-6xl">
          AI Red Teaming <span className="text-[#ff3434]">Command Center</span>
        </h1>

        <p className="mx-auto mt-5 max-w-[800px] text-[15px] leading-[1.85] text-[#d4d4d4]">
          Monitor AI model security, red teaming activity, critical findings,
          and defensive recommendations in one unified dashboard.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <HeroBadge label="Live Monitoring" tone="low" />
          <HeroBadge label="Multi-Model Testing" tone="cyan" />
          <HeroBadge label="OWASP AI Mapping" tone="high" />
          <HeroBadge label="Blue Team Review" tone="critical" />
        </div>

        <div className="mt-8 grid auto-rows-fr gap-3 md:grid-cols-4">
          <HeroMetric label="Total Scans" value={totalScans} tone="cyan" />
          <HeroMetric
            label="Critical Findings"
            value={criticalFindings}
            tone={criticalFindings > 0 ? "critical" : "low"}
          />
          <HeroMetric
            label="Failed Tests"
            value={failedTests}
            tone={failedTests > 0 ? "high" : "low"}
          />
          <HeroMetric
            label="Review Queue"
            value={reviewQueue}
            tone={reviewQueue > 0 ? "medium" : "low"}
          />
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-[850px] text-center">
      <h2 className="text-[clamp(22px,2.4vw,32px)] font-bold leading-tight tracking-[-0.6px] text-[#ff3434]">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-[780px] text-[13px] leading-[1.75] text-[#b7b7b7]">
        {description}
      </p>
    </div>
  );
}

function DashboardPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="h-full rounded-[23px] border border-white/[0.035] bg-[#1f2122] p-5 shadow-[0_12px_32px_rgba(0,0,0,.16)] md:p-7">
      <div className="mb-5 text-center">
        <h2 className="text-2xl font-bold tracking-[-0.6px] text-[#ff3434]">
          {title}
        </h2>
        <p className="mx-auto mt-2 max-w-[760px] text-[13px] leading-[1.75] text-[#b7b7b7]">
          {description}
        </p>
      </div>

      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  tone,
  compact = false,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  tone: RiskTone | "cyan";
  compact?: boolean;
}) {
  return (
    <article className="flex h-full min-h-[150px] flex-col justify-between rounded-[20px] border border-white/[0.05] bg-[#1f2122] p-5 text-center shadow-[0_12px_32px_rgba(0,0,0,.16)] transition hover:-translate-y-1 hover:border-[#ff3434]/35">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.9px] text-[#a9a9a9]">
          {label}
        </p>

        {compact ? (
          <h3
            className={`mt-4 break-words text-lg font-bold leading-snug ${riskValueClass(
              tone
            )}`}
          >
            {value}
          </h3>
        ) : (
          <h3
            className={`mt-4 font-mono text-3xl font-bold leading-none ${riskValueClass(
              tone
            )}`}
          >
            {value}
          </h3>
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-[#727272]">{subtitle}</p>
    </article>
  );
}

function RiskTrend({
  activity,
  totalFailed,
  totalCritical,
  totalBlocked,
}: {
  activity: RecentActivityItem[];
  totalFailed: number;
  totalCritical: number;
  totalBlocked: number;
}) {
  const trendData = buildTrendBuckets(activity);

  const chartData =
    trendData.length > 0
      ? trendData
      : [
          {
            label: "Current",
            failedTests: totalFailed,
            criticalFindings: totalCritical,
            blockedAttempts: totalBlocked,
          },
        ];

  const chartLeft = 95;
  const chartRight = 805;
  const chartTop = 38;
  const chartBottom = 345;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  const maxCount = Math.max(
    4,
    totalFailed,
    totalCritical,
    totalBlocked,
    ...chartData.map((item) =>
      Math.max(item.failedTests, item.criticalFindings, item.blockedAttempts)
    )
  );

  const yTicks = Array.from({ length: maxCount + 1 }, (_, index) => index);
  const groupCount = chartData.length;

  function getGroupCenter(index: number) {
    if (groupCount === 1) {
      return chartLeft + chartWidth / 2;
    }

    if (groupCount === 2) {
      return chartLeft + chartWidth * (index === 0 ? 0.36 : 0.64);
    }

    const spacing = chartWidth / Math.max(groupCount - 1, 1);
    return chartLeft + spacing * index;
  }

  const groupSpacing =
    groupCount <= 2 ? chartWidth * 0.28 : chartWidth / Math.max(groupCount - 1, 1);

  const barWidth = Math.max(16, Math.min(24, groupSpacing * 0.16));
  const barGap = 7;
  const groupWidth = barWidth * 3 + barGap * 2;
  const labelEvery = Math.max(1, Math.ceil(groupCount / 5));

  function getBarHeight(value: number) {
    return (value / maxCount) * chartHeight;
  }

  return (
    <div className="rounded-[20px] border border-white/[0.04] bg-[#27292a] p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <TrendStat
          label="Failed Tests"
          value={totalFailed}
          tone={totalFailed > 0 ? "high" : "low"}
        />
        <TrendStat
          label="Critical Findings"
          value={totalCritical}
          tone={totalCritical > 0 ? "critical" : "low"}
        />
        <TrendStat
          label="Blocked Attempts"
          value={totalBlocked}
          tone={totalBlocked > 0 ? "cyan" : "neutral"}
        />
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-x-7 gap-y-3 text-sm text-[#c2c2c2]">
        <Legend color="#ff3434" label="Failed Tests" />
        <Legend color="#ffd166" label="Critical Findings" />
        <Legend color="#4ad7ff" label="Blocked Attempts" />
      </div>

      <div className="mt-4 h-[405px] rounded-[18px] border border-white/[0.035] bg-[#17191a] p-4">
        {chartData.length === 0 ? (
          <EmptyMessage message="No recent backend activity is available yet." />
        ) : (
          <svg
            viewBox="0 0 880 420"
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full"
          >
            {yTicks.map((tick) => {
              const y = chartBottom - (tick / maxCount) * chartHeight;

              return (
                <g key={tick}>
                  <line
                    x1={chartLeft}
                    y1={y}
                    x2={chartRight}
                    y2={y}
                    stroke="rgba(132,150,184,0.20)"
                    strokeWidth="1.25"
                    strokeDasharray="5 7"
                  />
                  <text
                    x="68"
                    y={y + 5}
                    textAnchor="end"
                    fill="#a7b4cc"
                    fontSize="15"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="700"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            <line
              x1={chartLeft}
              y1={chartTop}
              x2={chartLeft}
              y2={chartBottom}
              stroke="rgba(167,180,204,0.48)"
              strokeWidth="1.8"
            />
            <line
              x1={chartLeft}
              y1={chartBottom}
              x2={chartRight}
              y2={chartBottom}
              stroke="rgba(167,180,204,0.48)"
              strokeWidth="1.8"
            />

            <text
              x={chartLeft}
              y="22"
              fill="#c0c9dc"
              fontSize="16"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="800"
            >
              Count
            </text>

            <text
              x={(chartLeft + chartRight) / 2}
              y="406"
              textAnchor="middle"
              fill="#c0c9dc"
              fontSize="15"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="700"
            >
              Recent Backend Activity
            </text>

            {chartData.map((item, index) => {
              const groupCenter = getGroupCenter(index);
              const groupStart = groupCenter - groupWidth / 2;

              const bars = [
                {
                  key: "failed",
                  value: item.failedTests,
                  color: "#ff3434",
                  x: groupStart,
                },
                {
                  key: "critical",
                  value: item.criticalFindings,
                  color: "#ffd166",
                  x: groupStart + barWidth + barGap,
                },
                {
                  key: "blocked",
                  value: item.blockedAttempts,
                  color: "#4ad7ff",
                  x: groupStart + (barWidth + barGap) * 2,
                },
              ];

              return (
                <g key={`${item.label}-${index}`}>
                  {bars.map((bar) => {
                    const barHeight = getBarHeight(bar.value);
                    const y = chartBottom - barHeight;

                    return (
                      <g key={bar.key}>
                        {bar.value > 0 && (
                          <>
                            <rect
                              x={bar.x}
                              y={y}
                              width={barWidth}
                              height={barHeight}
                              rx="2"
                              fill={bar.color}
                              opacity="0.95"
                            />
                            <text
                              x={bar.x + barWidth / 2}
                              y={y - 9}
                              textAnchor="middle"
                              fill={bar.color}
                              fontSize="14"
                              fontFamily="JetBrains Mono, monospace"
                              fontWeight="800"
                            >
                              {bar.value}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}

                  {index % labelEvery === 0 && (
                    <text
                      x={groupCenter}
                      y="374"
                      textAnchor="middle"
                      fill="#c0c9dc"
                      fontSize="15"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="700"
                    >
                      {item.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

function TrendStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: RiskTone | "cyan";
}) {
  return (
    <div className="rounded-[16px] border border-white/[0.04] bg-[#1f2122] px-4 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.8px] text-[#a9a9a9]">
        {label}
      </p>
      <p className={`mt-1.5 font-mono text-2xl font-bold ${riskValueClass(tone)}`}>
        {value}
      </p>
    </div>
  );
}

function AttackVectorDistribution({ items }: { items: DistributionItem[] }) {
  const normalized = normalizeAttackVectors(items);
  const maxCount = Math.max(...normalized.map((item) => item.count), 1);

  return (
    <div className="rounded-[20px] border border-white/[0.04] bg-[#27292a] p-4">
      {normalized.length === 0 ? (
        <EmptyMessage message="No attack vector data available from backend yet." />
      ) : (
        <div className="space-y-4">
          {normalized.map((item, index) => (
            <div key={`${item.label}-${index}`}>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="truncate text-[#e8e8e8]">{item.label}</span>
                <span className="font-mono font-bold text-white">{item.count}</span>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#1f2122]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.count / maxCount) * 100}%`,
                    backgroundColor: chartColors[index % chartColors.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiModelMatrix({
  models,
  safestModelName,
}: {
  models: ModelRiskSummary[];
  safestModelName: string | null;
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.035] bg-[#27292a]">
      <table className="w-full table-fixed border-collapse text-[11px] md:text-xs">
        <thead>
          <tr className="bg-[#1f2122]">
            <TableHead className="w-[32%]">Model</TableHead>
            <TableHead className="w-[14%]">Runs</TableHead>
            <TableHead className="w-[16%]">Avg Risk</TableHead>
            <TableHead className="w-[20%]">Failed/Vulnerable</TableHead>
            <TableHead className="w-[18%]">Status</TableHead>
          </tr>
        </thead>

        <tbody>
          {models.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-[#748097]">
                No model data available yet.
              </td>
            </tr>
          ) : (
            models.map((model) => {
              const tone = getRiskTone(model.average_risk_score);
              const isSafest = safestModelName === model.model_name;

              return (
                <tr key={model.model_name} className="transition hover:bg-[#2f3133]">
                  <TableCell strong>{model.model_name}</TableCell>
                  <TableCell>{model.total_runs}</TableCell>
                  <TableCell className={riskValueClass(tone)}>
                    {formatPercent(model.average_risk_score)}
                  </TableCell>
                  <TableCell>{model.failed_or_vulnerable_runs}</TableCell>
                  <TableCell>
                    <StatusBadge tone={isSafest ? "low" : tone}>
                      {isSafest
                        ? "Safest"
                        : getSecurityStatus(model.average_risk_score)}
                    </StatusBadge>
                  </TableCell>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function RecentFindings({ activity }: { activity: RecentActivityItem[] }) {
  return (
    <div className="rounded-[18px] border border-white/[0.035] bg-[#27292a]">
      <table className="w-full table-fixed border-collapse text-[11px] md:text-xs">
        <thead>
          <tr className="bg-[#1f2122]">
            <TableHead className="w-[16%]">Time</TableHead>
            <TableHead className="w-[24%]">Target</TableHead>
            <TableHead className="w-[26%]">Attack Type</TableHead>
            <TableHead className="w-[17%]">Severity</TableHead>
            <TableHead className="w-[17%]">Action</TableHead>
          </tr>
        </thead>

        <tbody>
          {activity.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-[#748097]">
                No recent findings available from backend.
              </td>
            </tr>
          ) : (
            activity.map((item) => {
              const score = item.risk_score ?? 0;
              const tone = getRiskTone(score);

              return (
                <tr key={item.id} className="transition hover:bg-[#2f3133]">
                  <TableCell>{formatTime(item.created_at)}</TableCell>
                  <TableCell strong>{item.model_name || "Unknown"}</TableCell>
                  <TableCell>{item.attack_name || item.scenario_id || "Unknown"}</TableCell>
                  <TableCell>
                    <StatusBadge tone={tone}>{getRiskLevel(score)}</StatusBadge>
                  </TableCell>
                  <TableCell>{getRecommendedAction(tone)}</TableCell>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function BlueTeamRecommendations({
  recommendations,
  apiError,
}: {
  recommendations: BlueTeamRecommendation[];
  apiError: string;
}) {
  if (apiError) {
    return (
      <div className="rounded-[18px] border border-[#ffd166]/20 bg-[#ffd166]/5 p-5 text-center text-sm leading-6 text-[#ffd166]">
        Blue Team recommendations could not be loaded from the backend: {apiError}
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="rounded-[18px] border border-white/[0.04] bg-[#27292a] p-5 text-center text-sm leading-6 text-[#a9a9a9]">
        No backend Blue Team recommendations are available yet. Run or review red
        team findings to generate defensive recommendations.
      </div>
    );
  }

  return (
    <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
      {recommendations.slice(0, 6).map((item) => (
        <article
          key={`${item.owasp_category}-${item.recommendation_title}`}
          className="flex h-full min-h-[210px] flex-col rounded-[20px] border border-white/[0.05] bg-[#27292a] p-5 transition hover:-translate-y-1 hover:border-[#ff3434]/35"
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={priorityTone(item.priority)}>
              {item.priority}
            </StatusBadge>
            <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-[#a9a9a9]">
              {item.review_status}
            </span>
          </div>

          <h3 className="mt-4 text-sm font-bold text-white">
            {item.recommendation_title}
          </h3>

          <p className="mt-3 text-sm leading-6 text-[#a9a9a9]">
            {item.defense_summary}
          </p>

          <p className="mt-3 text-xs leading-5 text-[#727272]">
            {item.evidence_summary}
          </p>

          {item.fix_instructions.length > 0 && (
            <ul className="mt-4 space-y-2 text-xs leading-5 text-[#d4d4d4]">
              {item.fix_instructions.slice(0, 3).map((step, index) => (
                <li key={`${step}-${index}`} className="flex gap-2">
                  <span className="text-[#ff3434]">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto pt-4 text-[11px] text-[#727272]">
            {item.owasp_category} · Related findings:{" "}
            {item.related_findings.length}
          </div>
        </article>
      ))}
    </div>
  );
}

function HeroBadge({
  label,
  tone,
}: {
  label: string;
  tone: RiskTone | "cyan";
}) {
  return (
    <span
      className={`rounded-full border px-4 py-2 text-xs font-semibold ${badgeToneClass(
        tone
      )}`}
    >
      {label}
    </span>
  );
}

function HeroMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: RiskTone | "cyan";
}) {
  return (
    <div className="flex h-full min-h-[86px] flex-col justify-center rounded-[18px] border border-white/[0.08] bg-[#27292a]/80 p-4 text-center backdrop-blur">
      <span className="text-[10px] font-semibold uppercase tracking-[0.7px] text-[#a9a9a9]">
        {label}
      </span>
      <strong className={`mt-2 font-mono text-xl ${riskValueClass(tone)}`}>
        {value}
      </strong>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-3 w-8 rounded" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function TableHead({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`border-b border-[#353637] px-2 py-3 text-left text-[10px] font-bold uppercase tracking-[0.7px] text-[#a9a9a9] ${className}`}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  className = "",
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <td
      className={`break-words border-b border-[#353637] px-2 py-3 align-middle text-[#e8e8e8] ${
        strong ? "font-semibold text-white" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: RiskTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-[10px] font-bold ${statusBadgeClass(
        tone
      )}`}
    >
      {children}
    </span>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="grid min-h-[180px] place-items-center text-center">
      <p className="text-sm text-[#727272]">{message}</p>
    </div>
  );
}

function buildTrendBuckets(activity: RecentActivityItem[]) {
  const recentActivity = [...activity].slice(0, 30).reverse();

  const buckets = new Map<
    string,
    {
      label: string;
      failedTests: number;
      criticalFindings: number;
      blockedAttempts: number;
    }
  >();

  recentActivity.forEach((item, index) => {
    const date = new Date(item.created_at);
    const isValidDate = !Number.isNaN(date.getTime());

    const key = isValidDate
      ? date.toISOString().slice(0, 10)
      : `run-${index + 1}`;

    const label = isValidDate
      ? date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : `Run ${index + 1}`;

    if (!buckets.has(key)) {
      buckets.set(key, {
        label,
        failedTests: 0,
        criticalFindings: 0,
        blockedAttempts: 0,
      });
    }

    const bucket = buckets.get(key);

    if (!bucket) return;

    if (isFailedSecurityTest(item)) {
      bucket.failedTests += 1;
    }

    if (isCriticalFinding(item)) {
      bucket.criticalFindings += 1;
    }

    if (isBlockedAttempt(item)) {
      bucket.blockedAttempts += 1;
    }
  });

  return Array.from(buckets.values());
}

function calculateBlockedAttempts(summary: DashboardSummary) {
  const blockedFromVerdicts = summary.human_verdict_distribution
    .filter((item) => isBlockedLabel(item.label))
    .reduce((total, item) => total + item.count, 0);

  if (blockedFromVerdicts > 0) {
    return blockedFromVerdicts;
  }

  const blockedFromRecentActivity = summary.recent_activity.filter(
    isBlockedAttempt
  ).length;

  if (blockedFromRecentActivity > 0) {
    return blockedFromRecentActivity;
  }

  return Math.max(summary.total_manual_runs - summary.failed_attacks, 0);
}

function isFailedSecurityTest(item: RecentActivityItem) {
  const value = `${item.final_status || ""} ${
    item.human_verdict || ""
  }`.toLowerCase();

  return (
    value.includes("vulnerable") ||
    value.includes("bypass") ||
    value.includes("failed") ||
    value.includes("unsafe") ||
    value.includes("attack_success") ||
    value.includes("successful_attack")
  );
}

function isCriticalFinding(item: RecentActivityItem) {
  return (
    (item.risk_score ?? 0) >= 81 ||
    (item.severity || "").toLowerCase() === "critical"
  );
}

function isBlockedAttempt(item: RecentActivityItem) {
  const value = `${item.final_status || ""} ${
    item.human_verdict || ""
  }`.toLowerCase();

  return isBlockedLabel(value);
}

function isBlockedLabel(value: string) {
  const text = value.toLowerCase();

  return (
    text.includes("blocked") ||
    text.includes("refused") ||
    text.includes("resisted") ||
    text.includes("prevented") ||
    text.includes("protected") ||
    text.includes("safe") ||
    text.includes("passed") ||
    text.includes("not_vulnerable") ||
    text.includes("not vulnerable") ||
    text.includes("false_positive") ||
    text.includes("false positive")
  );
}

function normalizeAttackVectors(items: DistributionItem[]) {
  if (items.length === 0) return [];

  return [...items].sort((a, b) => b.count - a.count).slice(0, 6);
}

function getRiskLevel(score: number) {
  if (score >= 81) return "Critical";
  if (score >= 61) return "High";
  if (score >= 31) return "Medium";

  return "Low";
}

function getRiskTone(score: number): RiskTone {
  if (score >= 81) return "critical";
  if (score >= 61) return "high";
  if (score >= 31) return "medium";

  return "low";
}

function getSecurityStatus(score: number) {
  if (score <= 25) return "Good";
  if (score <= 45) return "Warning";
  if (score <= 70) return "High Risk";

  return "Critical";
}

function getRecommendedAction(tone: RiskTone) {
  if (tone === "critical") return "Escalate";
  if (tone === "high") return "Review";
  if (tone === "medium") return "Patch";

  return "Monitor";
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercent(value: number) {
  const rounded = Math.round(value * 100) / 100;

  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(2)}%`;
}

function priorityTone(priority: string): RiskTone {
  const normalized = priority.toLowerCase();

  if (normalized.includes("critical")) return "critical";
  if (normalized.includes("high")) return "high";
  if (normalized.includes("medium")) return "medium";
  if (normalized.includes("low")) return "low";

  return "neutral";
}

function riskValueClass(tone: RiskTone | "cyan") {
  return {
    critical: "text-[#ff3434]",
    high: "text-[#ffb347]",
    medium: "text-[#ffd166]",
    low: "text-[#30d158]",
    neutral: "text-white",
    cyan: "text-[#4ad7ff]",
  }[tone];
}

function badgeToneClass(tone: RiskTone | "cyan") {
  return {
    critical: "border-[#ff3434]/35 bg-[#ff3434]/10 text-[#ff3434]",
    high: "border-[#ffb347]/35 bg-[#ffb347]/10 text-[#ffb347]",
    medium: "border-[#ffd166]/35 bg-[#ffd166]/10 text-[#ffd166]",
    low: "border-[#30d158]/35 bg-[#30d158]/10 text-[#30d158]",
    neutral: "border-white/[0.12] bg-[#27292a]/80 text-[#a9a9a9]",
    cyan: "border-[#4ad7ff]/35 bg-[#4ad7ff]/10 text-[#4ad7ff]",
  }[tone];
}

function statusBadgeClass(tone: RiskTone) {
  return {
    critical: "bg-[#ff3434]/13 text-[#ff3434]",
    high: "bg-[#ffb347]/13 text-[#ffb347]",
    medium: "bg-[#ffd166]/12 text-[#ffd166]",
    low: "bg-[#30d158]/13 text-[#30d158]",
    neutral: "bg-white/[0.08] text-[#a9a9a9]",
  }[tone];
}
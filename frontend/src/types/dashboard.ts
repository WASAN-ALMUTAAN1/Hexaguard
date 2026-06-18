export type DistributionItem = {
  label: string;
  count: number;
};

export type RecentActivityItem = {
  id: number;
  scenario_id?: string | null;
  attack_name?: string | null;
  model_name: string;
  severity?: string | null;
  final_status?: string | null;
  human_verdict?: string | null;
  risk_score?: number | null;
  created_at: string;
};

export type ModelRiskSummary = {
  model_name: string;
  total_runs: number;
  average_risk_score: number;
  failed_or_vulnerable_runs: number;
};

export type DashboardSummary = {
  total_scenarios: number;
  total_manual_runs: number;
  critical_scenarios: number;
  critical_manual_runs: number;
  successful_attacks: number;
  failed_attacks: number;
  average_risk_score: number;
  most_tested_model?: string | null;
  most_vulnerable_model?: string | null;
  safest_model?: string | null;
  severity_distribution: DistributionItem[];
  owasp_distribution: DistributionItem[];
  human_verdict_distribution: DistributionItem[];
  model_risk_summary: ModelRiskSummary[];
  recent_activity: RecentActivityItem[];
};

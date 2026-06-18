export type RelatedFinding = {
  run_id: number;
  scenario_id?: string | null;
  attack_name?: string | null;
  model_name: string;
  severity?: string | null;
  risk_score?: number | null;
  human_verdict?: string | null;
  final_status?: string | null;
  analyst_notes?: string | null;
  created_at: string;
};

export type OwaspSummaryItem = {
  owasp_category: string;
  count: number;
  highest_priority: string;
};

export type BlueTeamRecommendation = {
  owasp_category: string;
  attack_category?: string | null;
  priority: string;
  review_status: string;
  recommendation_title: string;
  defense_summary: string;
  evidence_summary: string;
  fix_instructions: string[];
  verification_steps: string[];
  related_findings: RelatedFinding[];
};

export type BlueTeamRecommendationResponse = {
  total_recommendations: number;
  critical_priority_count: number;
  high_priority_count: number;
  needs_review_count: number;
  owasp_summary: OwaspSummaryItem[];
  recommendations: BlueTeamRecommendation[];
};

export type BlueTeamAgentAnalysisRequest = {
  owasp_category?: string | null;
  run_ids?: number[];
  analysis_mode: "defensive";
  include_executive_summary: boolean;
};

export type BlueTeamAgentAnalysisResponse = {
  agent_status: string;
  analysis_mode: string;
  owasp_category: string;
  priority: string;
  review_status: string;
  risk_interpretation: string;
  evidence_used: string[];
  defense_plan: string[];
  verification_plan: string[];
  residual_risk: string;
  executive_summary: string;
  confidence: string;
  requires_human_review: boolean;
  guardrail_status: string;
  agent_trace: string[];
  source: string;
};

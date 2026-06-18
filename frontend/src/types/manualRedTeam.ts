export type ManualRedTeamRun = {
  id: number;

  scenario_pk?: number | null;
  scenario_id?: string | null;
  attack_name?: string | null;
  attack_category?: string | null;
  severity?: string | null;
  owasp_category?: string | null;

  model_name: string;
  original_prompt: string;
  edited_prompt: string;

  sandbox_report?: Record<string, unknown> | null;
  model_response?: Record<string, unknown> | null;
  ai_evaluation?: Record<string, unknown> | null;
  risk_assessment?: Record<string, unknown> | null;

  final_status?: string | null;
  human_verdict?: string | null;
  analyst_notes?: string | null;

  created_at: string;
  updated_at: string;
};

export type ManualRedTeamRunCreate = {
  scenario_pk?: number | null;
  scenario_id?: string | null;
  attack_name?: string | null;
  attack_category?: string | null;
  severity?: string | null;
  owasp_category?: string | null;

  model_name: string;
  original_prompt: string;
  edited_prompt: string;

  sandbox_report?: Record<string, unknown> | null;
  model_response?: Record<string, unknown> | null;
  ai_evaluation?: Record<string, unknown> | null;
  risk_assessment?: Record<string, unknown> | null;

  final_status?: string | null;
  human_verdict?: string | null;
  analyst_notes?: string | null;
};

export type ManualRedTeamRunListResponse = {
  total: number;
  limit: number;
  offset: number;
  items: ManualRedTeamRun[];
};

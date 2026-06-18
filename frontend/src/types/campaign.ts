export type CampaignCreateRequest = {
  name: string;
  description?: string;
  test_source_type: "scenario_library" | "uploaded_dataset";
  dataset_id?: string | null;
  selected_models: string[];
  selected_scenario_ids: string[];
  selected_categories: string[];
  selected_mutations: string[];
  max_tests: number;
};

export type CampaignResponse = {
  id: number;
  campaign_id: string;
  name: string;
  description?: string | null;
  status: string;

  test_source_type?: string;
  dataset_id?: string | null;
  dataset_name?: string | null;
  dataset_row_count?: number | null;

  selected_models: string[];
  selected_scenario_ids: string[];
  selected_categories: string[];
  selected_mutations: string[];

  max_tests: number;
  total_tests: number;
  completed_tests: number;
  failed_tests: number;
  critical_findings: number;
  average_risk_score: number;

  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
};

export type CampaignRunResponse = {
  campaign_id: string;
  status: string;
  message: string;
};

export type CampaignStatusResponse = {
  campaign_id: string;
  name: string;
  status: string;

  test_source_type?: string;
  dataset_id?: string | null;
  dataset_name?: string | null;
  dataset_row_count?: number | null;

  max_tests: number;
  total_tests: number;
  completed_tests: number;
  failed_tests: number;
  critical_findings: number;
  average_risk_score: number;
  progress_percent: number;

  started_at?: string | null;
  completed_at?: string | null;
};

export type InputEvaluation = {
  risk_level: string;
  detected_attack_types: string[];
  attack_intent: string;
  confidence: string;
  safe_to_run_in_sandbox: boolean;
  reason: string;
};

export type ModelResponse = {
  output?: string | null;
  latency_ms?: number | null;
  tokens_used?: number | null;
  estimated_cost?: number | null;
  error?: string | null;
  tool_calls?: unknown;
};

export type OutputEvaluation = {
  attack_success: boolean;
  refusal_quality?: string | null;
  sensitive_data_leaked: boolean;
  unsafe_output_detected: boolean;
  tool_misuse_detected: boolean;
  rag_injection_success: boolean;
  reasoning?: string | null;
  evidence?: string[];
  confidence?: string | null;
};

export type RiskAssessment = {
  risk_score: number;
  severity: string;
  confidence?: string | null;
  needs_human_review: boolean;
};

export type OwaspMappingItem = {
  id: string;
  name: string;
  reason: string;
};

export type SandboxReport = {
  test_id: string;
  platform: string;
  attack_scenario: string;
  provider: string;
  model: string;
  access_type: string;
  input_prompt: string;
  input_evaluation: InputEvaluation;
  model_response: ModelResponse;
  output_evaluation: OutputEvaluation;
  risk_assessment: RiskAssessment;
  owasp_mapping: OwaspMappingItem[];
  blue_team_recommendation: string[];
  final_status: string;
};

export type CampaignResult = {
  id: number;
  campaign_pk: number;
  campaign_id: string;

  scenario_pk?: number | null;
  scenario_id: string;
  attack_name: string;
  attack_category: string;
  severity: string;
  risk_level?: string;
  subcategory?: string | null;
  owasp_category?: string | null;

  model_name: string;
  mutation_type: string;

  input_prompt: string;
  mutated_prompt: string;

  sandbox_report?: SandboxReport | null;
  model_response?: ModelResponse | null;
  ai_evaluation?: OutputEvaluation | null;
  risk_assessment?: RiskAssessment | null;

  risk_score: number;
  final_status?: string | null;
  error_message?: string | null;

  created_at: string;
};

export type CampaignResultsListResponse = {
  campaign_id: string;
  total: number;
  items: CampaignResult[];
};

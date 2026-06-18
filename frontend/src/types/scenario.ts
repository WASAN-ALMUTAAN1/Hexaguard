export type Severity = "Low" | "Medium" | "High" | "Critical";

export type Scenario = {
  id: number;
  scenario_id: string;
  attack_name: string;
  attack_category: string;
  prompt_template: string;
  risk_goal: string;
  expected_safe_behavior: string;
  unsafe_behavior: string;
  severity: Severity;
  owasp_category: string;
  mitre_atlas_mapping?: string | null;
  requires_tool: boolean;
  requires_rag: boolean;
  language: string;
  mutation_type?: string | null;
  source?: string | null;
  tags: string[];
  safe_for_demo: boolean;
  dataset_version?: string | null;
  expected_label?: string | null;
  review_status: string;
  created_at: string;
  updated_at: string;
};

export type ScenarioCreatePayload = {
  scenario_id: string;
  attack_name: string;
  attack_category: string;
  prompt_template: string;
  risk_goal: string;
  expected_safe_behavior: string;
  unsafe_behavior: string;
  severity: Severity;
  owasp_category: string;
  mitre_atlas_mapping?: string | null;
  requires_tool: boolean;
  requires_rag: boolean;
  language: string;
  mutation_type?: string | null;
  source?: string | null;
  tags: string[];
  safe_for_demo: boolean;
  dataset_version?: string | null;
  expected_label?: string | null;
  review_status: string;
};

export type ScenarioUpdatePayload = Partial<
  Omit<ScenarioCreatePayload, "scenario_id">
>;

export type ScenarioListResponse = {
  total: number;
  limit: number;
  offset: number;
  items: Scenario[];
};

export type ScenarioFilters = {
  categories: string[];
  severities: string[];
  owasp_categories: string[];
};

export type ScenarioQuery = {
  search?: string;
  category?: string;
  severity?: string;
  owasp?: string;
  safe_for_demo?: boolean;
  limit?: number;
  offset?: number;
};

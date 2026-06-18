export interface SandboxRequest {
  prompt: string;
  model_name: string;
  attack_category: string;
  severity: string;
  mutation_type?: string;
  is_rag_test?: boolean;
  malicious_payload?: string;
  documents?: any[];
}

export interface SandboxResponse {
  original_prompt: string;
  mutated_prompt: string;
  model_response: {
    status: string;
    response_text: string;
    latency_ms: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost: number;
  };
  is_rag_test: boolean;
  rag_leak_detected: boolean;
  evaluation: {
    attack_success: boolean;
    risk_score: number;
    severity: string;
    confidence: number;
    owasp_mapping: string;
    reason: string;
    evidence: string;
  };
  blue_team_recommendations: string[];
}

export interface ScenarioBase {
  scenario_id: string;
  attack_name: string;
  attack_category: string;
  prompt_template: string;
  risk_goal: string;
  expected_safe_behavior: string;
  unsafe_behavior: string;
  severity: string;
  owasp_category: string;
  requires_tool?: boolean;
  requires_rag?: boolean;
  safe_for_demo?: boolean;
}

export interface ScenarioResponse extends ScenarioBase {
  id: number;
  created_at: string;
  updated_at: string;
}

export interface ScenarioCreate extends ScenarioBase {}
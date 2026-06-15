export type DatasetSourceType =
  | "local_upload"
  | "direct_url"
  | "github_raw"
  | "huggingface"
  | "kaggle";

export type DatasetColumnMapping = {
  prompt?: string | null;
  row_id?: string | null;
  attack_category?: string | null;
  severity?: string | null;
  risk_level?: string | null;
  subcategory?: string | null;
  owasp_category?: string | null;
  expected_safe_behavior?: string | null;
  language?: string | null;
  tags?: string | null;
};

export type DatasetCompatibilityReport = {
  total_rows_detected: number;
  valid_rows: number;
  invalid_rows: number;
  original_columns: string[];
  detected_mapping: Record<string, string | null>;
  missing_prompt_rows: number;
  detected_categories: string[];
  detected_severities: string[];
  owasp_mapping_coverage_percent: number;
  ready_for_campaign: boolean;
  messages: string[];
};

export type DatasetRow = {
  id: number;
  dataset_pk: number;
  dataset_id: string;
  row_id: string;
  prompt: string;
  attack_category: string;
  severity: string;
  risk_level?: string;
  subcategory?: string | null;
  owasp_category?: string | null;
  expected_safe_behavior?: string | null;
  language?: string | null;
  tags: string[];
  row_metadata: Record<string, unknown>;
  created_at: string;
};

export type Dataset = {
  id: number;
  dataset_id: string;
  name: string;
  filename: string;
  file_type: string;
  source_type: string;
  source_uri?: string | null;
  row_count: number;
  validation_status: string;
  validation_message?: string | null;
  original_columns?: string[] | null;
  detected_mapping?: Record<string, unknown> | null;
  validation_report?: DatasetCompatibilityReport | null;
  created_at: string;
};

export type DatasetUploadResponse = {
  dataset: Dataset;
  preview_rows: DatasetRow[];
};

export type DatasetImportRequest = {
  source_type: "direct_url" | "github_raw" | "huggingface" | "kaggle";
  source_uri: string;
  name?: string;
  max_rows: number;
  column_mapping?: DatasetColumnMapping;

  // Request-only secrets. These are sent to backend for import only.
  hf_token?: string | null;
  kaggle_username?: string | null;
  kaggle_key?: string | null;
  kaggle_api_token?: string | null;
  kaggle_file_path?: string | null;
};

export type DatasetImportResponse = {
  dataset: Dataset;
  preview_rows: DatasetRow[];
  compatibility_report: DatasetCompatibilityReport;
};

export type DatasetListResponse = {
  total: number;
  items: Dataset[];
};

export type DatasetRowsListResponse = {
  dataset_id: string;
  total: number;
  items: DatasetRow[];
};

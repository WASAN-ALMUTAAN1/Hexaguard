const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");

export type CampaignLibraryItem = {
  id: number;
  campaign_id: string;
  name: string;
  description?: string | null;
  status: string;
  test_source_type?: string | null;
  dataset_id?: string | null;
  dataset_name?: string | null;
  dataset_row_count?: number | null;
  selected_models: string[];
  selected_scenario_ids: string[];
  selected_categories: string[];
  selected_mutations: string[];
  max_tests?: number | null;
  total_tests: number;
  completed_tests: number;
  failed_tests: number;
  critical_findings: number;
  average_risk_score: number;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

export type CampaignLibraryResponse = {
  total: number;
  limit: number;
  offset: number;
  items: CampaignLibraryItem[];
};

export type CampaignLibraryFilters = {
  status?: string;
  dataset_id?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export async function listCampaigns(
  filters: CampaignLibraryFilters = {}
): Promise<CampaignLibraryResponse> {
  const params = new URLSearchParams();

  if (filters.status) params.set("status", filters.status);
  if (filters.dataset_id) params.set("dataset_id", filters.dataset_id);
  if (filters.q) params.set("q", filters.q);
  params.set("limit", String(filters.limit ?? 20));
  params.set("offset", String(filters.offset ?? 0));

  const response = await fetch(`${API_BASE_URL}/campaigns?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Failed to load campaign library.");
  }

  return data as CampaignLibraryResponse;
}

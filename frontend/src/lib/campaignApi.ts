import type {
  CampaignCreateRequest,
  CampaignResponse,
  CampaignResultsListResponse,
  CampaignRunResponse,
  CampaignStatusResponse,
} from "@/types/campaign";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      data &&
      typeof data === "object" &&
      "detail" in data &&
      typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : `HEXAGUARD API error ${response.status}`;

    throw new Error(detail);
  }

  return data as T;
}

export async function createCampaign(
  payload: CampaignCreateRequest
): Promise<CampaignResponse> {
  const response = await fetch(`${API_BASE_URL}/campaigns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<CampaignResponse>(response);
}

export async function runCampaign(
  campaignId: string
): Promise<CampaignRunResponse> {
  const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}/run`, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  return parseApiResponse<CampaignRunResponse>(response);
}

export async function getCampaignStatus(
  campaignId: string
): Promise<CampaignStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}/status`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  return parseApiResponse<CampaignStatusResponse>(response);
}

export async function getCampaignResults(
  campaignId: string
): Promise<CampaignResultsListResponse> {
  const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}/results`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  return parseApiResponse<CampaignResultsListResponse>(response);
}

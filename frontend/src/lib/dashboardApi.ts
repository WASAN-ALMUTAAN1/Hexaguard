import { DashboardSummary } from "../types/dashboard";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_HEXAGUARD_API_URL || "http://127.0.0.1:8000/api/v1";

async function parseApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || "Invalid response from HEXAGUARD API.");
  }

  if (!response.ok) {
    const detail =
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : `HEXAGUARD API error ${response.status}`;

    throw new Error(detail);
  }

  return data as T;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch(`${API_BASE_URL}/dashboard/summary`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  return parseApiResponse<DashboardSummary>(response);
}

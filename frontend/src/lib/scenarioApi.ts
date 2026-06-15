import {
  Scenario,
  ScenarioCreatePayload,
  ScenarioFilters,
  ScenarioListResponse,
  ScenarioQuery,
  ScenarioUpdatePayload,
} from "../types/scenario";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_HEXAGUARD_API_URL || "http://127.0.0.1:8000/api/v1";

async function parseApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(text || "Invalid JSON response from HEXAGUARD API.");
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

export async function listScenarios(
  query: ScenarioQuery = {}
): Promise<ScenarioListResponse> {
  const params = new URLSearchParams();

  if (query.search) params.set("search", query.search);
  if (query.category) params.set("category", query.category);
  if (query.severity) params.set("severity", query.severity);
  if (query.owasp) params.set("owasp", query.owasp);
  if (query.safe_for_demo !== undefined) {
    params.set("safe_for_demo", String(query.safe_for_demo));
  }

  params.set("limit", String(query.limit ?? 25));
  params.set("offset", String(query.offset ?? 0));

  const response = await fetch(`${API_BASE_URL}/scenarios/?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return parseApiResponse<ScenarioListResponse>(response);
}

export async function getScenario(scenarioId: string): Promise<Scenario> {
  const response = await fetch(
    `${API_BASE_URL}/scenarios/${encodeURIComponent(scenarioId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  return parseApiResponse<Scenario>(response);
}

export async function getScenarioFilters(): Promise<ScenarioFilters> {
  const response = await fetch(`${API_BASE_URL}/scenarios/filters`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  return parseApiResponse<ScenarioFilters>(response);
}

export async function createScenario(
  payload: ScenarioCreatePayload
): Promise<Scenario> {
  const response = await fetch(`${API_BASE_URL}/scenarios/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<Scenario>(response);
}

export async function updateScenario(
  scenarioId: string,
  payload: ScenarioUpdatePayload
): Promise<Scenario> {
  const response = await fetch(
    `${API_BASE_URL}/scenarios/${encodeURIComponent(scenarioId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return parseApiResponse<Scenario>(response);
}

export async function deleteScenario(
  scenarioId: string
): Promise<{ deleted: boolean; scenario_id: string }> {
  const response = await fetch(
    `${API_BASE_URL}/scenarios/${encodeURIComponent(scenarioId)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    }
  );

  return parseApiResponse<{ deleted: boolean; scenario_id: string }>(response);
}

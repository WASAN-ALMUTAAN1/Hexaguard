const API_BASE_URL =
  process.env.NEXT_PUBLIC_HEXAGUARD_API_URL || "http://127.0.0.1:8000/api/v1";

export type SandboxRunPayload = {
  prompt: string;
  model_name: string;
  scenario: string;
  context?: string;
  user_id?: string;
};

export type CompareModelsPayload = {
  prompt: string;
  models: string[];
  scenario: string;
  context?: string;
  user_id?: string;
};

export type ProviderCredential = {
  provider: string;
  apiKey?: string;
  endpoint?: string;
};

function getProviderFromModelName(modelName: string) {
  return modelName.includes(":") ? modelName.split(":")[0] : "mock";
}

function getStoredProviderCredential(provider: string): ProviderCredential | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(`hexaguard_provider_${provider}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildByokFieldsForModel(modelName: string) {
  const provider = getProviderFromModelName(modelName);
  const credential = getStoredProviderCredential(provider);

  if (!credential) return {};

  return {
    custom_key: credential.apiKey || undefined,
    custom_endpoint: credential.endpoint || undefined,
  };
}

function buildByokFieldsForModels(models: string[]) {
  for (const modelName of models) {
    const fields = buildByokFieldsForModel(modelName) as {
      custom_key?: string;
      custom_endpoint?: string;
    };

    if (fields.custom_key || fields.custom_endpoint) {
      return fields;
    }
  }

  return {};
}

export async function runSandboxTest(payload: SandboxRunPayload) {
  const response = await fetch(`${API_BASE_URL}/sandbox/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: "sys_user_01",
      ...payload,
      ...buildByokFieldsForModel(payload.model_name),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HEXAGUARD API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function compareModels(payload: CompareModelsPayload) {
  const response = await fetch(`${API_BASE_URL}/sandbox/compare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: "sys_user_01",
      ...payload,
      ...buildByokFieldsForModels(payload.models),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HEXAGUARD API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function uploadDatasetForTesting(params: {
  file: File;
  model_name: string;
  user_id?: string;
}) {
  const formData = new FormData();
  formData.append("file", params.file);

  const modelName = encodeURIComponent(params.model_name);
  const userId = encodeURIComponent(params.user_id || "sys_user_01");

  const response = await fetch(
    `${API_BASE_URL}/sandbox/dataset/upload?model_name=${modelName}&user_id=${userId}`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HEXAGUARD Dataset Upload Error ${response.status}: ${errorText}`);
  }

  return response.json();
}

export function saveProviderCredential(credential: ProviderCredential) {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    `hexaguard_provider_${credential.provider}`,
    JSON.stringify(credential)
  );
}

export function removeProviderCredential(provider: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`hexaguard_provider_${provider}`);
}

export function loadProviderCredential(provider: string): ProviderCredential | null {
  return getStoredProviderCredential(provider);
}

export function saveLatestReport(reportType: string, report: any) {
  if (typeof window === "undefined") return;

  const savedReport = {
    type: reportType,
    saved_at: new Date().toISOString(),
    report,
  };

  localStorage.setItem("hexaguard_latest_report", JSON.stringify(savedReport));
}

export function loadLatestReport() {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem("hexaguard_latest_report");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearLatestReport() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("hexaguard_latest_report");
}

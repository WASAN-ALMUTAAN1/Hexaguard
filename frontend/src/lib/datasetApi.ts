import type {
  DatasetImportRequest,
  DatasetImportResponse,
  DatasetListResponse,
  DatasetRowsListResponse,
  DatasetUploadResponse,
} from "@/types/dataset";

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

export async function uploadDataset(
  file: File,
  name?: string
): Promise<DatasetUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  if (name) {
    formData.append("name", name);
  }

  const response = await fetch(`${API_BASE_URL}/datasets/upload`, {
    method: "POST",
    body: formData,
  });

  return parseApiResponse<DatasetUploadResponse>(response);
}

export async function importDataset(
  payload: DatasetImportRequest
): Promise<DatasetImportResponse> {
  const response = await fetch(`${API_BASE_URL}/datasets/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<DatasetImportResponse>(response);
}

export async function listDatasets(): Promise<DatasetListResponse> {
  const response = await fetch(`${API_BASE_URL}/datasets`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  return parseApiResponse<DatasetListResponse>(response);
}

export async function getDatasetRows(
  datasetId: string
): Promise<DatasetRowsListResponse> {
  const response = await fetch(`${API_BASE_URL}/datasets/${datasetId}/rows`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  return parseApiResponse<DatasetRowsListResponse>(response);
}

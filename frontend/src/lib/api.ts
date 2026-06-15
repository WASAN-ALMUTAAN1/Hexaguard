import { ScenarioCreate, ScenarioResponse } from "@/types/api";

// Make sure this matches exactly where your backend is running
export const API_BASE_URL = "http://localhost:8000/api/v1";
export async function executeSandbox(request: any) {
  const response = await fetch(`${API_BASE_URL}/sandbox/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
 });
  
  if (!response.ok) throw new Error("Failed to execute sandbox test.");
  
  // YOU WERE MISSING THIS LINE:
  return response.json(); 
}



export async function getScenarios(): Promise<ScenarioResponse[]> {
  const response = await fetch(`${API_BASE_URL}/scenarios/`, { cache: 'no-store' });
  if (!response.ok) throw new Error("Failed to fetch scenarios");
  return response.json();
}

export async function createScenario(data: ScenarioCreate): Promise<ScenarioResponse> {
  const response = await fetch(`${API_BASE_URL}/scenarios/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
 });
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.detail || "Failed to create scenario");
 }
  return response.json();
}

export async function runCampaign(name: string, model_name: string, attack_category: string) {
  const response = await fetch(`${API_BASE_URL}/campaigns/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, model_name, attack_category }),
 });
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.detail || "Campaign execution failed");
 }
  return response.json();
}

export async function getTelemetryLogs() {
  const response = await fetch(`${API_BASE_URL}/reports/telemetry`, { cache: 'no-store' });
  if (!response.ok) throw new Error("Failed to fetch telemetry logs");
  return response.json();
}
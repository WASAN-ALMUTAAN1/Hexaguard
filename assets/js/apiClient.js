/* =========================================================
   Hexaguard API Client
   ========================================================= */

class HexaguardApiClient {
  constructor(config) {
    this.config = config;
    this.baseUrl = String(config.API_BASE_URL || "").replace(/\/$/, "");
    this.mockMode = Boolean(config.MOCK_MODE);
  }

  endpoint(name, params = {}) {
    const template = this.config.ENDPOINTS[name];

    if (!template) {
      throw new Error(`Unknown endpoint: ${name}`);
    }

    return Object.entries(params).reduce((path, [key, value]) => {
      return path.replace(`{${key}}`, encodeURIComponent(value));
    }, template);
  }

  async request(endpointName, options = {}) {
    if (this.mockMode) {
      return null;
    }

    const path = this.endpoint(endpointName, options.params || {});
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {})
      },
      body: options.body instanceof FormData
        ? options.body
        : options.body
          ? JSON.stringify(options.body)
          : undefined
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return response.json();
    }

    return response.text();
  }

  listScenarios(query = {}) {
    if (this.mockMode) return null;

    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, value);
      }
    });

    const baseEndpoint = this.config.ENDPOINTS.scenarios;
    const suffix = params.toString() ? `?${params.toString()}` : "";

    return this.rawGet(`${this.baseUrl}${baseEndpoint}${suffix}`);
  }

  async rawGet(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
  }

  createScenario(payload) {
    return this.request("createScenario", {
      method: "POST",
      body: payload
    });
  }

  runScenario(id, payload = {}) {
    return this.request("runScenario", {
      method: "POST",
      params: { id },
      body: payload
    });
  }

  replayScenario(id, payload = {}) {
    return this.request("replayScenario", {
      method: "POST",
      params: { id },
      body: payload
    });
  }

  generateAttack(payload = {}) {
    return this.request("generateAttack", {
      method: "POST",
      body: payload
    });
  }

  addToCampaign(payload = {}) {
    return this.request("addToCampaign", {
      method: "POST",
      body: payload
    });
  }

  importDataset(file) {
    const formData = new FormData();
    formData.append("file", file);

    return this.request("importDataset", {
      method: "POST",
      body: formData
    });
  }

  generateReport(payload = {}) {
    return this.request("generateReport", {
      method: "POST",
      body: payload
    });
  }

  exportLibrary(query = {}) {
    return this.request("exportLibrary", {
      method: "POST",
      body: query
    });
  }

  getManualSession() {
    return this.request("manualSession");
  }

  configureManualAttack(payload = {}) {
    return this.request("manualConfigure", {
      method: "POST",
      body: payload
    });
  }

  saveManualPrompt(payload = {}) {
    return this.request("manualPrompt", {
      method: "POST",
      body: payload
    });
  }

  runManualAttack(payload = {}) {
    return this.request("manualRun", {
      method: "POST",
      body: payload
    });
  }

  submitManualVerdict(payload = {}) {
    return this.request("manualVerdict", {
      method: "POST",
      body: payload
    });
  }

  saveManualResult(payload = {}) {
    return this.request("manualSaveResult", {
      method: "POST",
      body: payload
    });
  }

  generateManualReport(payload = {}) {
    return this.request("manualGenerateReport", {
      method: "POST",
      body: payload
    });
  }

  addManualResultToDataset(payload = {}) {
    return this.request("manualAddToDataset", {
      method: "POST",
      body: payload
    });
  }

  sendManualReviewQueue(payload = {}) {
    return this.request("manualReviewQueue", {
      method: "POST",
      body: payload
    });
  }

  createManualIncident(payload = {}) {
    return this.request("manualIncident", {
      method: "POST",
      body: payload
    });
  }

  addManualResultToCampaign(payload = {}) {
    return this.request("manualAddToCampaign", {
      method: "POST",
      body: payload
    });
  }

  replayManualAttack(id, payload = {}) {
    return this.request("manualReplay", {
      method: "POST",
      params: { id },
      body: payload
    });
  }

  getSandboxSession() {
    return this.request("sandboxSession");
  }

  analyzeSandboxPrompt(payload = {}) {
    return this.request("sandboxAnalyze", {
      method: "POST",
      body: payload
    });
  }

  applySandboxMutation(payload = {}) {
    return this.request("sandboxMutation", {
      method: "POST",
      body: payload
    });
  }

  saveSandboxResult(payload = {}) {
    return this.request("sandboxSaveResult", {
      method: "POST",
      body: payload
    });
  }

  exportSandboxReport(payload = {}) {
    return this.request("sandboxExportReport", {
      method: "POST",
      body: payload
    });
  }
}

window.hexaguardApi = new HexaguardApiClient(window.HEXAGUARD_CONFIG);

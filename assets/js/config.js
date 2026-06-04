/* =========================================================
   Hexaguard Frontend Configuration
   ========================================================= */

window.HEXAGUARD_CONFIG = Object.freeze({
  APP_NAME: "Hexaguard Attack Scenario Library",

  MOCK_MODE: true,

  API_BASE_URL: "http://localhost:8000/api",

  ENDPOINTS: Object.freeze({
    scenarios: "/scenarios",
    scenarioById: "/scenarios/{id}",
    runScenario: "/scenarios/{id}/run",
    replayScenario: "/scenarios/{id}/replay",
    createScenario: "/scenarios",
    importDataset: "/datasets/import",
    generateAttack: "/attacks/generate",
    addToCampaign: "/campaigns/scenarios",
    exportLibrary: "/scenarios/export",
    generateReport: "/reports/intelligence",

    manualSession: "/manual-red-team/session",
    manualConfigure: "/manual-red-team/configure",
    manualPrompt: "/manual-red-team/prompt",
    manualRun: "/manual-red-team/run",
    manualVerdict: "/manual-red-team/verdict",
    manualSaveResult: "/manual-red-team/results",
    manualGenerateReport: "/manual-red-team/reports",
    manualAddToDataset: "/manual-red-team/dataset",
    manualReviewQueue: "/manual-red-team/review-queue",
    manualIncident: "/manual-red-team/incidents",
    manualAddToCampaign: "/manual-red-team/campaigns",
    manualReplay: "/manual-red-team/replay/{id}",

    sandboxSession: "/sandbox/session",
    sandboxAnalyze: "/sandbox/analyze",
    sandboxMutation: "/sandbox/mutation",
    sandboxSaveResult: "/sandbox/results",
    sandboxExportReport: "/sandbox/reports"
  })
});

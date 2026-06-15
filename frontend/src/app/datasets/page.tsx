"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  getDatasetRows,
  importDataset,
  listDatasets,
  uploadDataset,
} from "../../lib/datasetApi";
import type {
  Dataset,
  DatasetColumnMapping,
  DatasetCompatibilityReport,
  DatasetImportRequest,
  DatasetRow,
  DatasetSourceType,
} from "../../types/dataset";

type NonLocalDatasetSource = Exclude<DatasetSourceType, "local_upload">;
type ImportStep = 1 | 2 | 3;

const SOURCE_OPTIONS: {
  value: DatasetSourceType;
  title: string;
  description: string;
  badge: string;
}[] = [
  {
    value: "local_upload",
    title: "CSV / JSON Upload",
    description: "Upload a local prompt dataset.",
    badge: "Local",
  },
  {
    value: "github_raw",
    title: "GitHub Raw",
    description: "Import a raw CSV or JSON file URL.",
    badge: "Public",
  },
  {
    value: "direct_url",
    title: "Direct URL",
    description: "Use a public CSV or JSON URL.",
    badge: "Public",
  },
  {
    value: "huggingface",
    title: "HuggingFace",
    description: "Import a public dataset source.",
    badge: "Connector",
  },
  {
    value: "kaggle",
    title: "Kaggle",
    description: "Import a Kaggle dataset source.",
    badge: "Connector",
  },
];

const REQUIRED_MAPPING_FIELDS: { key: keyof DatasetColumnMapping; label: string }[] = [
  { key: "prompt", label: "Prompt" },
  { key: "row_id", label: "Row ID" },
  { key: "attack_category", label: "Attack Category" },
  { key: "severity", label: "Severity" },
];

const OPTIONAL_MAPPING_FIELDS: { key: keyof DatasetColumnMapping; label: string }[] = [
  { key: "risk_level", label: "Risk Level" },
  { key: "subcategory", label: "Subcategory" },
  { key: "owasp_category", label: "OWASP Category" },
  { key: "expected_safe_behavior", label: "Expected Safe Behavior" },
  { key: "language", label: "Language" },
  { key: "tags", label: "Tags" },
];

function defaultSourceUri(sourceType: DatasetSourceType): string {
  if (sourceType === "github_raw") {
    return "https://raw.githubusercontent.com/NaviRocker/llm-red-teaming-dataset/main/prompts/redteam_master_dataset.csv";
  }

  if (sourceType === "huggingface") {
    return "cornell-movie-review-data/rotten_tomatoes:default:train";
  }

  if (sourceType === "kaggle") {
    return "pyotam/ai-village-defcon-red-teaming-competition-dataset";
  }

  if (sourceType === "direct_url") {
    return "https://example.com/dataset.csv";
  }

  return "";
}

function defaultMapping(sourceType: DatasetSourceType): DatasetColumnMapping {
  if (sourceType === "github_raw") {
    return {
      prompt: "prompt",
      row_id: "prompt_id",
      attack_category: "category",
      severity: "severity",
      risk_level: "risk_level",
      subcategory: "subcategory",
      expected_safe_behavior: "description",
    };
  }

  if (sourceType === "huggingface") {
    return {
      prompt: "text",
      expected_safe_behavior: "label",
    };
  }

  return {
    prompt: "",
    row_id: "",
    attack_category: "",
    severity: "",
    risk_level: "",
    subcategory: "",
    owasp_category: "",
    expected_safe_behavior: "",
    language: "",
    tags: "",
  };
}

function cleanMapping(mapping: DatasetColumnMapping): DatasetColumnMapping {
  return Object.fromEntries(
    Object.entries(mapping).map(([key, value]) => [
      key,
      value && String(value).trim() ? String(value).trim() : null,
    ])
  );
}

function normalizeDetectedMapping(
  mapping: Partial<Record<keyof DatasetColumnMapping, unknown>> | null | undefined
): DatasetColumnMapping {
  const normalized: DatasetColumnMapping = {};

  [...REQUIRED_MAPPING_FIELDS, ...OPTIONAL_MAPPING_FIELDS].forEach((field) => {
    const value = mapping?.[field.key];
    normalized[field.key] =
      value === null || value === undefined ? "" : String(value);
  });

  return normalized;
}

function isDatasetReady(dataset: Dataset): boolean {
  return (
    dataset.validation_status?.toLowerCase() === "validated" ||
    Boolean(dataset.validation_report?.ready_for_campaign)
  );
}

function formatDate(value?: string): string {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}


function getDetectedColumnsForMapping({
  compatibilityReport,
  activeDataset,
  previewRows,
  columnMapping,
}: {
  compatibilityReport: DatasetCompatibilityReport | null;
  activeDataset: Dataset | null;
  previewRows: DatasetRow[];
  columnMapping: DatasetColumnMapping;
}): string[] {
  const columns = new Set<string>();

  const internalColumns = new Set([
    "dataset_id",
    "dataset_pk",
    "created_at",
    "updated_at",
    "row_metadata",
    "metadata",
    "source",
    "source_type",
    "validation_status",
  ]);

  function addColumn(value: unknown) {
    if (value === null || value === undefined) return;

    const column = String(value).trim();

    if (!column) return;
    if (internalColumns.has(column)) return;

    columns.add(column);
  }

  function addColumnList(value: unknown) {
    if (!Array.isArray(value)) return;
    value.forEach(addColumn);
  }

  const reportLike = compatibilityReport as
    | (DatasetCompatibilityReport & {
        detected_columns?: string[];
        original_columns?: string[];
        columns?: string[];
      })
    | null;

  const datasetLike = activeDataset as
    | (Dataset & {
        original_columns?: string[];
        detected_columns?: string[];
        columns?: string[];
      })
    | null;

  addColumnList(reportLike?.detected_columns);
  addColumnList(reportLike?.original_columns);
  addColumnList(reportLike?.columns);
  addColumnList(datasetLike?.original_columns);
  addColumnList(datasetLike?.detected_columns);
  addColumnList(datasetLike?.columns);

  Object.values(compatibilityReport?.detected_mapping || {}).forEach(addColumn);
  Object.values(activeDataset?.detected_mapping || {}).forEach(addColumn);
  Object.values(columnMapping).forEach(addColumn);

  // Fallback only if backend did not return detected/original columns.
  // This avoids showing backend metadata fields unless no better source exists.
  if (columns.size === 0 && previewRows[0]) {
    Object.keys(previewRows[0] as Record<string, unknown>).forEach(addColumn);
  }

  return Array.from(columns).sort((a, b) => a.localeCompare(b));
}

function getMissingRequiredMappings(mapping: DatasetColumnMapping): string[] {
  return REQUIRED_MAPPING_FIELDS.filter((field) => {
    const value = mapping[field.key];
    return !value || !String(value).trim();
  }).map((field) => field.label);
}

function formatSourceLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function DatasetsPage() {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>(1);

  const [sourceType, setSourceType] = useState<DatasetSourceType>("github_raw");
  const [datasetName, setDatasetName] = useState("Client Demo Red Team Dataset");
  const [sourceUri, setSourceUri] = useState(defaultSourceUri("github_raw"));
  const [file, setFile] = useState<File | null>(null);
  const [maxRows, setMaxRows] = useState("20");
  const [columnMapping, setColumnMapping] = useState<DatasetColumnMapping>(
    defaultMapping("github_raw")
  );
  const [mappingEdited, setMappingEdited] = useState(false);

  const [hfToken, setHfToken] = useState("");
  const [kaggleUsername, setKaggleUsername] = useState("");
  const [kaggleKey, setKaggleKey] = useState("");
  const [kaggleFilePath, setKaggleFilePath] = useState("");
  const [showKaggleCredentials, setShowKaggleCredentials] = useState(false);

  const [savedDatasets, setSavedDatasets] = useState<Dataset[]>([]);
  const [selectedSavedDatasetId, setSelectedSavedDatasetId] = useState("");
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [previewRows, setPreviewRows] = useState<DatasetRow[]>([]);
  const [compatibilityReport, setCompatibilityReport] =
    useState<DatasetCompatibilityReport | null>(null);
  const [datasetSaved, setDatasetSaved] = useState(false);

  const [openDatasetMenuId, setOpenDatasetMenuId] = useState<string | null>(null);
  const [detailsDataset, setDetailsDataset] = useState<Dataset | null>(null);
  const [mappingModalDataset, setMappingModalDataset] = useState<Dataset | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [, setDatasetLibraryLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const totalDatasets = savedDatasets.length;
  const validatedDatasets = savedDatasets.filter(isDatasetReady).length;
  const totalPromptRows = savedDatasets.reduce(
    (sum, dataset) => sum + Number(dataset.row_count || 0),
    0
  );
  const campaignReady = savedDatasets.filter(isDatasetReady).length;

  const sourceOptions = useMemo(() => {
    return Array.from(
      new Set(savedDatasets.map((dataset) => dataset.source_type).filter(Boolean))
    ).sort();
  }, [savedDatasets]);

  const statusOptions = useMemo(() => {
    return Array.from(
      new Set(savedDatasets.map((dataset) => dataset.validation_status).filter(Boolean))
    ).sort();
  }, [savedDatasets]);

  const filteredDatasets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return savedDatasets.filter((dataset) => {
      const matchesSearch =
        !query ||
        [
          dataset.name,
          dataset.dataset_id,
          dataset.filename,
          dataset.source_type,
          dataset.validation_status,
          dataset.source_uri || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesSource = !sourceFilter || dataset.source_type === sourceFilter;
      const matchesStatus = !statusFilter || dataset.validation_status === statusFilter;

      return matchesSearch && matchesSource && matchesStatus;
    });
  }, [savedDatasets, search, sourceFilter, statusFilter]);

  const activeReady = Boolean(activeDataset && isDatasetReady(activeDataset));

  const detectedColumns = useMemo(
    () =>
      getDetectedColumnsForMapping({
        compatibilityReport,
        activeDataset,
        previewRows,
        columnMapping,
      }),
    [compatibilityReport, activeDataset, previewRows, columnMapping]
  );

  const missingRequiredMappings = useMemo(
    () => getMissingRequiredMappings(columnMapping),
    [columnMapping]
  );

  const canContinueMapping = missingRequiredMappings.length === 0;

  async function loadDatasetLibrary() {
    setDatasetLibraryLoading(true);
    setErrorMessage("");

    try {
      const response = await listDatasets();
      setSavedDatasets(Array.isArray(response.items) ? response.items : []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load saved datasets."
      );
    } finally {
      setDatasetLibraryLoading(false);
    }
  }

  useEffect(() => {
    void loadDatasetLibrary();
  }, []);

  function resetImportWorkspace() {
    setImportStep(1);
    setSourceType("github_raw");
    setDatasetName("Client Demo Red Team Dataset");
    setSourceUri(defaultSourceUri("github_raw"));
    setFile(null);
    setMaxRows("20");
    setColumnMapping(defaultMapping("github_raw"));
    setMappingEdited(false);
    setHfToken("");
    setKaggleUsername("");
    setKaggleKey("");
    setKaggleFilePath("");
    setShowKaggleCredentials(false);
    setActiveDataset(null);
    setPreviewRows([]);
    setCompatibilityReport(null);
    setDatasetSaved(false);
    setNotice("");
    setErrorMessage("");
    setLoadingMessage("");
  }

  function openImportWorkspace() {
    resetImportWorkspace();
    setIsImportOpen(true);
  }

  function handleSourceChange(nextSourceType: DatasetSourceType) {
    setSourceType(nextSourceType);
    setSourceUri(defaultSourceUri(nextSourceType));
    setColumnMapping(defaultMapping(nextSourceType));
    setMappingEdited(false);
    setFile(null);
    setActiveDataset(null);
    setPreviewRows([]);
    setCompatibilityReport(null);
    setDatasetSaved(false);
    setImportStep(1);
    setNotice("");
    setErrorMessage("");
  }

  async function handleSelectSavedDataset(dataset: Dataset) {
    setErrorMessage("");
    setNotice("");
    setLoadingMessage("Loading saved dataset rows...");

    try {
      const rowsResponse = await getDatasetRows(dataset.dataset_id);
      const report = dataset.validation_report || null;

      setActiveDataset(dataset);
      setSelectedSavedDatasetId(dataset.dataset_id);
      setPreviewRows(Array.isArray(rowsResponse.items) ? rowsResponse.items : []);
      setCompatibilityReport(report);
      setDatasetSaved(true);
      setColumnMapping(
        normalizeDetectedMapping(report?.detected_mapping || dataset.detected_mapping || {})
      );
      setMappingEdited(false);
      setIsImportOpen(true);
      setImportStep(3);
      setNotice(`Dataset loaded successfully: ${dataset.name}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load selected dataset rows."
      );
    } finally {
      setLoadingMessage("");
    }
  }

  async function handleEditDataset(dataset: Dataset) {
    setErrorMessage("");
    setNotice("");
    setLoadingMessage("Loading dataset mapping...");

    try {
      const rowsResponse = await getDatasetRows(dataset.dataset_id);
      const report = dataset.validation_report || null;

      setActiveDataset(dataset);
      setSelectedSavedDatasetId(dataset.dataset_id);
      setPreviewRows(Array.isArray(rowsResponse.items) ? rowsResponse.items : []);
      setCompatibilityReport(report);
      setColumnMapping(
        normalizeDetectedMapping(report?.detected_mapping || dataset.detected_mapping || {})
      );
      setMappingEdited(false);
      setOpenDatasetMenuId(null);
      setMappingModalDataset(dataset);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load dataset mapping."
      );
    } finally {
      setLoadingMessage("");
    }
  }

async function handleDatasetImport() {
    setErrorMessage("");
    setNotice("");
    setLoadingMessage("Importing and validating dataset...");

    try {
      if (sourceType === "local_upload") {
        if (!file) {
          throw new Error("Choose a CSV or JSON file before importing.");
        }

        const response = await uploadDataset(file, datasetName || file.name);
        const report = response.dataset.validation_report || null;

        setActiveDataset(response.dataset);
        setPreviewRows(Array.isArray(response.preview_rows) ? response.preview_rows : []);
        setCompatibilityReport(report);
        setColumnMapping(
          normalizeDetectedMapping(report?.detected_mapping || response.dataset.detected_mapping || {})
        );
        setMappingEdited(false);
        setSelectedSavedDatasetId(response.dataset.dataset_id);
      } else {
        const payload: DatasetImportRequest = {
          source_type: sourceType as NonLocalDatasetSource,
          source_uri: sourceUri,
          name: datasetName,
          max_rows: Number(maxRows) || 20,
          column_mapping: cleanMapping(columnMapping),
        };

        if (sourceType === "huggingface" && hfToken.trim()) {
          payload.hf_token = hfToken.trim();
        }

        if (sourceType === "kaggle") {
          payload.kaggle_username = kaggleUsername.trim() || null;
          payload.kaggle_key = kaggleKey.trim() || null;
          payload.kaggle_file_path = kaggleFilePath.trim() || null;
        }

        const response = await importDataset(payload);
        const report =
          response.compatibility_report || response.dataset.validation_report || null;

        setActiveDataset(response.dataset);
        setPreviewRows(Array.isArray(response.preview_rows) ? response.preview_rows : []);
        setCompatibilityReport(report);
        setColumnMapping(
          normalizeDetectedMapping(report?.detected_mapping || response.dataset.detected_mapping || {})
        );
        setMappingEdited(false);
        setSelectedSavedDatasetId(response.dataset.dataset_id);
        setKaggleKey("");
      }

      setMappingEdited(false);
      setDatasetSaved(false);
      setImportStep(2);
      setNotice("Dataset imported and validated successfully. Review mapping before preview.");
      await loadDatasetLibrary();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Dataset import failed.");
    } finally {
      setLoadingMessage("");
    }
  }

  function handleConfirmMapping() {
    setCompatibilityReport((previous) =>
      previous
        ? {
            ...previous,
            detected_mapping: cleanMapping(columnMapping),
          }
        : previous
    );

    setMappingEdited(false);
    setImportStep(3);
  }

  async function handleSaveDataset() {
    await loadDatasetLibrary();
    setDatasetSaved(true);
    setNotice("Dataset saved successfully. This dataset is ready for campaign testing.");
  }

  function clearFilters() {
    setSearch("");
    setSourceFilter("");
    setStatusFilter("");
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[23px] border border-white/[0.04] bg-[#27292a]/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.24)] md:p-8">
        <div className="rounded-[20px] border border-white/[0.05] bg-[#1f2122]/95 p-5 shadow-[0_14px_32px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-[#4ad7ff]">
                Prompt Dataset Database
              </p>
              <h1 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">
                Prompt Dataset Library
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[#d4d4d4]">
                Manage bulk red-team prompt collections, source imports, validation mapping,
                and campaign-ready datasets.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">

              <button
                type="button"
                onClick={openImportWorkspace}
                className="whitespace-nowrap rounded-[12px] bg-[#ff3434] px-4 py-2 text-xs font-black text-white shadow-[0_0_16px_rgba(255,52,52,0.18)] transition hover:bg-[#ff4545]">
                + Import Dataset
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-white/[0.06] pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Total Datasets" value={String(totalDatasets)} tone="cyan" />
              <MetricCard label="Validated Datasets" value={String(validatedDatasets)} tone="green" />
              <MetricCard label="Total Prompt Rows" value={String(totalPromptRows)} tone="orange" />
              <MetricCard label="Campaign-Ready" value={String(campaignReady)} tone="green" />
            </div>
          </div>
        </div>

        {(notice || errorMessage || loadingMessage) && (
          <section
            className={`mt-5 rounded-[14px] border px-4 py-3 text-sm font-bold ${
              errorMessage
                ? "border-[#ff3434]/30 bg-[#ff3434]/10 text-[#ff3434]"
                : loadingMessage
                  ? "border-[#4ad7ff]/30 bg-[#4ad7ff]/10 text-[#4ad7ff]"
                  : "border-emerald-400/30 bg-emerald-500/10 text-[#30d158]"
            }`}
          >
            {errorMessage || loadingMessage || notice}
          </section>
        )}

        {isImportOpen && (
          <section className="mt-5 rounded-[20px] border border-white/[0.06] bg-[#17191a]/95 p-5 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-[#ff3434]">
                  Import Dataset Workspace
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="rounded-[10px] border border-white/[0.08] bg-[#27292a] px-3 py-2 text-xs font-black text-white transition hover:bg-white/[0.06]"
              >
                Back to Dataset Library
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <StepCard active={importStep === 1} completed={importStep > 1} title="Step 1" subtitle="Select Source" />
              <StepCard active={importStep === 2} completed={importStep > 2} title="Step 2" subtitle="Validate & Map" />
              <StepCard active={importStep === 3} completed={false} title="Step 3" subtitle="Preview & Save" />
            </div>

            {compatibilityReport && importStep === 3 && (
              <section className="mt-5 rounded-[16px] border border-white/[0.05] bg-[#1f2122] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-[#4ad7ff]">
                      Dataset Validation Report
                    </p>
                    <h3 className="mt-2 text-xl font-black text-white">
                      Campaign Readiness
                    </h3>
                  </div>

                  <StatusPill ready={compatibilityReport.ready_for_campaign}>
                    {compatibilityReport.ready_for_campaign
                      ? "Dataset is campaign-ready"
                      : "Needs Mapping Review"}
                  </StatusPill>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <MetricCard
                    label="Detected Rows"
                    value={String(compatibilityReport.total_rows_detected)}
                    tone="cyan"
                  />
                  <MetricCard
                    label="Valid Rows"
                    value={String(compatibilityReport.valid_rows)}
                    tone="green"
                  />
                  <MetricCard
                    label="Invalid Rows"
                    value={String(compatibilityReport.invalid_rows)}
                    tone={compatibilityReport.invalid_rows > 0 ? "orange" : "green"}
                  />
                  <MetricCard
                    label="OWASP Coverage"
                    value={`${compatibilityReport.owasp_mapping_coverage_percent}%`}
                    tone="cyan"
                  />
                </div>

              </section>
            )}

            {importStep === 1 && (
              <section className="mt-5">
                <div className="grid gap-3 md:grid-cols-5">
                  {SOURCE_OPTIONS.map((option) => {
                    const selected = sourceType === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSourceChange(option.value)}
                        className={`relative rounded-[16px] border p-4 text-left transition ${
                          selected
                            ? "border-[#4ad7ff]/45 bg-[#4ad7ff]/10"
                            : "border-white/[0.05] bg-[#27292a] hover:border-white/[0.14]"
                        }`}
                      >
                        {selected && (
                          <span className="absolute right-3 top-3 rounded-full border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-2 py-0.5 text-[10px] font-black text-[#4ad7ff]">
                            Selected
                          </span>
                        )}
                        <p className="pr-16 text-[13px] font-black text-white">{option.title}</p>
                        <p className="mt-2 text-[11px] leading-5 text-[#727272]">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Field label="Dataset Name">
                    <TextInput value={datasetName} onChange={setDatasetName} />
                  </Field>

                  <Field label="Maximum Rows">
                    <TextInput value={maxRows} onChange={setMaxRows} type="number" />
                  </Field>

                  {sourceType === "local_upload" && (
                    <Field label="Choose File">
                      <input
                        type="file"
                        accept=".csv,.json,application/json,text/csv"
                        onChange={(event) => setFile(event.target.files?.[0] || null)}
                        className="block w-full rounded-[14px] border border-white/[0.04] bg-[#27292a] px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-[#ff3434] file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
                      />
                    </Field>
                  )}

                  {sourceType === "github_raw" && (
                    <Field label="Raw GitHub URL">
                      <TextInput value={sourceUri} onChange={setSourceUri} />
                    </Field>
                  )}

                  {sourceType === "direct_url" && (
                    <Field label="Public CSV / JSON URL">
                      <TextInput value={sourceUri} onChange={setSourceUri} />
                    </Field>
                  )}

                  {sourceType === "huggingface" && (
                    <>
                      <Field label="Dataset ID">
                        <TextInput value={sourceUri} onChange={setSourceUri} />
                      </Field>
                      <Field label="Optional Token">
                        <TextInput value={hfToken} onChange={setHfToken} />
                      </Field>
                    </>
                  )}

                  {sourceType === "kaggle" && (
                    <>
                      <Field label="Kaggle Dataset Slug">
                        <TextInput value={sourceUri} onChange={setSourceUri} />
                      </Field>
                      <Field label="Optional File Path">
                        <TextInput value={kaggleFilePath} onChange={setKaggleFilePath} />
                      </Field>
                    </>
                  )}
                </div>

                {sourceType === "kaggle" && (
                  <div className="mt-4 rounded-[14px] border border-white/[0.06] bg-[#1f2122] p-4">
                    <button
                      type="button"
                      onClick={() => setShowKaggleCredentials(!showKaggleCredentials)}
                      className="text-xs font-black text-[#4ad7ff]"
                    >
                      {showKaggleCredentials
                        ? "Hide optional Kaggle credentials"
                        : "Add optional Kaggle credentials"}
                    </button>

                    {showKaggleCredentials && (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Kaggle Username">
                          <TextInput value={kaggleUsername} onChange={setKaggleUsername} />
                        </Field>
                        <Field label="Kaggle Key">
                          <TextInput value={kaggleKey} onChange={setKaggleKey} />
                        </Field>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDatasetImport}
                  disabled={Boolean(loadingMessage)}
                  className="mt-5 rounded-[12px] bg-[#ff3434] px-4 py-2 text-xs font-black text-white shadow-[0_0_16px_rgba(255,52,52,0.18)] transition hover:bg-[#ff4545] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Import & Validate Dataset
                </button>
              </section>
            )}

            {importStep === 2 && (
              <section className="mt-5">
                <div className="rounded-[16px] border border-white/[0.05] bg-[#1f2122] p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-[#4ad7ff]">
                        Detected Mapping
                      </p>
                      <h3 className="mt-2 text-xl font-black text-white">
                        Review / Edit Mapping
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#a9a9a9]">
                        Required fields are shown first. Optional metadata improves filtering,
                        OWASP grouping, and campaign reporting.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setColumnMapping(
                          normalizeDetectedMapping(
                            compatibilityReport?.detected_mapping ||
                              activeDataset?.detected_mapping ||
                              {}
                          )
                        );
                        setMappingEdited(false);
                      }}
                      className="rounded-[10px] border border-white/[0.08] bg-[#27292a] px-3 py-2 text-xs font-black text-white transition hover:bg-white/[0.06]"
                    >
                      Reset Auto-Mapping
                    </button>
                  </div>

                  <MappingGroup
                    title="Required Mapping"
                    fields={REQUIRED_MAPPING_FIELDS}
                    columnMapping={columnMapping}
                    setColumnMapping={setColumnMapping}
                    detectedColumns={detectedColumns}
                    isRequired
                    onMappingEdited={() => setMappingEdited(true)}
                  />

                  <MappingGroup
                    title="Optional Metadata"
                    fields={OPTIONAL_MAPPING_FIELDS}
                    columnMapping={columnMapping}
                    setColumnMapping={setColumnMapping}
                    detectedColumns={detectedColumns}
                    isRequired={false}
                    onMappingEdited={() => setMappingEdited(true)}
                  />

                  {missingRequiredMappings.length > 0 && (
                    <div className="mt-5 rounded-[14px] border border-[#ffb347]/25 bg-[#ffb347]/10 p-4 text-sm leading-6 text-[#ffb347]">
                      Required mapping is incomplete: {missingRequiredMappings.join(", ")}.
                      Choose detected dataset columns before continuing.
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {mappingEdited && (
                        <button
                          type="button"
                          onClick={handleDatasetImport}
                          disabled={Boolean(loadingMessage) || !canContinueMapping}
                          className="rounded-[10px] border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-4 py-2 text-xs font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/16 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Apply Changes & Re-Validate
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmMapping}
                      disabled={!canContinueMapping}
                      className="rounded-[12px] bg-[#ff3434] px-4 py-2 text-xs font-black text-white transition hover:bg-[#ff4545] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Confirm & Continue to Preview
                    </button>
                  </div>
                </div>
              </section>
            )}

            {importStep === 3 && (
              <section className="mt-5">
                <div className="rounded-[16px] border border-white/[0.05] bg-[#1f2122] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-[#4ad7ff]">
                        Dataset Preview
                      </p>
                      <h3 className="mt-2 text-xl font-black text-white">
                        Normalized Prompt Rows
                      </h3>
                      <p className="mt-2 text-sm text-[#a9a9a9]">
                        Showing the first rows only. Full campaign execution belongs inside Campaigns.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 max-h-[380px] overflow-auto rounded-[14px] border border-white/[0.06]">
                    <table className="min-w-[900px] w-full border-collapse text-sm">
                      <thead className="sticky top-0 z-10 bg-[#17191a]">
                        <tr>
                          <TableHead>Row</TableHead>
                          <TableHead>Prompt</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Risk</TableHead>
                          <TableHead>OWASP</TableHead>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-5 py-10 text-center text-sm text-[#727272]">
                              No preview rows available yet.
                            </td>
                          </tr>
                        ) : (
                          previewRows.slice(0, 10).map((row) => (
                            <tr key={`${row.dataset_id}-${row.id}-${row.row_id}`} className="border-t border-white/[0.05]">
                              <td className="px-4 py-3 font-mono text-xs text-[#4ad7ff]">
                                {row.row_id}
                              </td>
                              <td className="px-4 py-3 text-sm text-[#d4d4d4]">
                                <span className="line-clamp-2">{row.prompt}</span>
                              </td>
                              <td className="px-4 py-3 text-sm text-[#a9a9a9]">
                                {row.attack_category || "Unknown"}
                              </td>
                              <td className="px-4 py-3">
                                <RiskBadge level={row.risk_level || row.severity || "Unknown"} />
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex max-w-[220px] truncate whitespace-nowrap rounded-full border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-3 py-1 text-xs font-black text-[#4ad7ff]">
                                  {row.owasp_category || "—"}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    {datasetSaved ? (
                      <>
                        <button
                          type="button"
                          onClick={openImportWorkspace}
                          className="rounded-[10px] border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-4 py-2 text-xs font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/16"
                        >
                          Import Another Dataset
                        </button>

                        <Link
                          href={
                            activeDataset
                              ? `/campaigns?dataset=${encodeURIComponent(activeDataset.dataset_id)}`
                              : "/campaigns"
                          }
                          className={`inline-flex items-center rounded-[12px] px-4 py-2 text-xs font-black transition ${
                            activeReady
                              ? "bg-[#30d158] text-[#07120a] hover:bg-[#47e36e]"
                              : "pointer-events-none border border-white/[0.08] bg-[#27292a] text-[#727272] opacity-50"
                          }`}
                        >
                          Use in Campaign
                        </Link>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSaveDataset}
                        className="ml-auto rounded-[12px] bg-[#ff3434] px-4 py-2 text-xs font-black text-white transition hover:bg-[#ff4545]"
                      >
                        Save Dataset
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}
          </section>
        )}

        <section className="mt-5 rounded-[16px] border border-white/[0.05] bg-[#1f2122]/95 p-2.5 shadow-[0_10px_26px_rgba(0,0,0,0.14)]">
          <div className="grid gap-2 xl:grid-cols-[minmax(260px,1.25fr)_repeat(2,minmax(170px,0.45fr))_auto]">
            <label className="flex min-h-[40px] items-center gap-3 rounded-[12px] border border-white/[0.07] bg-[#27292a] px-4">
              <span className="text-sm text-[#727272]">⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search datasets, sources, formats..."
                className="w-full border-0 bg-transparent text-sm text-white outline-none placeholder:text-[#727272]"
              />
            </label>

            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="h-10 rounded-[12px] border border-white/[0.07] bg-[#27292a] px-3 text-sm font-bold text-white outline-none"
            >
              <option value="">All sources</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {formatSourceLabel(source)}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-[12px] border border-white/[0.07] bg-[#27292a] px-3 text-sm font-bold text-white outline-none"
            >
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatSourceLabel(status)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={clearFilters}
              className="h-10 rounded-[12px] border border-white/[0.08] bg-[#27292a] px-4 text-sm font-black text-white transition hover:bg-white/[0.05]"
            >
              Clear
            </button>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#1f2122]">
          <div className="max-h-[390px] overflow-auto">
            <table className="min-w-[980px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-[#17191a]">
                <tr>
                  <TableHead>Dataset</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead align="center">Rows</TableHead>
                  <TableHead align="center">Validation</TableHead>
                  <TableHead align="center">Mapping</TableHead>
                  <TableHead align="center">Updated</TableHead>
                  <TableHead align="center">Actions</TableHead>
                </tr>
              </thead>

              <tbody>
                {filteredDatasets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-10 text-center text-sm text-[#727272]"
                    >
                      No saved prompt datasets found.
                    </td>
                  </tr>
                ) : (
                  filteredDatasets.map((dataset) => {
                    const selected = selectedSavedDatasetId === dataset.dataset_id;
                    const ready = isDatasetReady(dataset);

                    return (
                      <tr
                        key={dataset.dataset_id}
                        onClick={() => setSelectedSavedDatasetId(dataset.dataset_id)}
                        className={`cursor-pointer border-t border-white/[0.05] transition ${
                          selected ? "bg-[#ff3434]/10" : "hover:bg-white/[0.025]"
                        }`}
                      >
                        <td className="px-5 py-3">
                          <p className="text-[13px] font-black text-white">{dataset.name}</p>
                          <p className="mt-1 font-mono text-[11px] text-[#4ad7ff]">
                            {dataset.dataset_id}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full border border-white/[0.08] bg-[#27292a] px-3 py-1 text-xs font-black text-[#d4d4d4]">
                            {formatSourceLabel(dataset.source_type)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center font-mono text-sm font-black text-white">
                          {dataset.row_count}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <StatusPill ready={ready}>
                            {dataset.validation_status || "unknown"}
                          </StatusPill>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className="rounded-full border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-3 py-1 text-xs font-black text-[#4ad7ff]">
                            {dataset.validation_report?.ready_for_campaign
                              ? "Ready"
                              : dataset.detected_mapping?.prompt
                                ? "Mapped"
                                : "Needs Mapping"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center text-sm text-[#a9a9a9]">
                          {formatDate(dataset.created_at)}
                        </td>

                        <td className="px-5 py-3 text-center">
                          <div className="relative flex justify-center">
                            <button
                              type="button"
                              aria-label={`Open actions for ${dataset.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenDatasetMenuId(
                                  openDatasetMenuId === dataset.dataset_id
                                    ? null
                                    : dataset.dataset_id
                                );
                              }}
                              className="grid h-8 w-8 place-items-center rounded-[9px] border border-white/[0.08] bg-[#27292a] text-lg font-black leading-none text-[#d4d4d4] transition hover:border-[#4ad7ff]/35 hover:bg-white/[0.06] hover:text-white"
                            >
                              ...
                            </button>

                            {openDatasetMenuId === dataset.dataset_id && (
                              <div className="absolute right-0 top-10 z-40 w-52 rounded-[14px] border border-white/[0.08] bg-[#1f2122]/95 p-1.5 text-left shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenDatasetMenuId(null);
                                    setDetailsDataset(dataset);
                                  }}
                                  className="block w-full rounded-[10px] px-3 py-2.5 text-left text-xs font-black text-white transition hover:bg-white/[0.06]"
                                >
                                  View Details
                                </button>

                                <Link
                                  href={`/campaigns?dataset=${encodeURIComponent(dataset.dataset_id)}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenDatasetMenuId(null);
                                  }}
                                  className={`block rounded-[10px] px-3 py-2.5 text-xs font-black transition ${
                                    ready
                                      ? "text-[#30d158] hover:bg-[#30d158]/10"
                                      : "pointer-events-none text-[#727272] opacity-50"
                                  }`}
                                >
                                  Use in Campaign
                                </Link>

                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenDatasetMenuId(null);
                                    void handleEditDataset(dataset);
                                  }}
                                  className="block w-full rounded-[10px] px-3 py-2.5 text-left text-xs font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10"
                                >
                                  Edit / Review Mapping
                                </button>

                                <div className="my-1 border-t border-white/[0.06]" />

                                <button
                                  type="button"
                                  disabled
                                  title="Delete Dataset needs a backend delete endpoint before enabling."
                                  onClick={(event) => {
                                    event.stopPropagation();
                                  }}
                                  className="block w-full cursor-not-allowed rounded-[10px] px-3 py-2.5 text-left text-xs font-black text-[#ff3434] opacity-45"
                                >
                                  Delete Dataset
                                </button>

                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenDatasetMenuId(null);
                                    void navigator.clipboard.writeText(dataset.dataset_id);
                                  }}
                                  className="block w-full rounded-[10px] px-3 py-2.5 text-left text-xs font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10"
                                >
                                  Copy Dataset ID
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
        {detailsDataset && (
          <DatasetDetailsModal
            dataset={detailsDataset}
            onClose={() => setDetailsDataset(null)}
          />
        )}

        {mappingModalDataset && (
          <DatasetMappingModal
            dataset={mappingModalDataset}
            columnMapping={columnMapping}
            setColumnMapping={setColumnMapping}
            detectedColumns={detectedColumns}
            missingRequiredMappings={missingRequiredMappings}
            mappingEdited={mappingEdited}
            onMappingEdited={() => setMappingEdited(true)}
            onReset={() => {
              setColumnMapping(
                normalizeDetectedMapping(
                  compatibilityReport?.detected_mapping ||
                    activeDataset?.detected_mapping ||
                    mappingModalDataset.detected_mapping ||
                    {}
                )
              );
              setMappingEdited(false);
            }}
            onClose={() => {
              setMappingModalDataset(null);
              setMappingEdited(false);
            }}
            onConfirm={() => {
              setCompatibilityReport((previous) =>
                previous
                  ? {
                      ...previous,
                      detected_mapping: cleanMapping(columnMapping),
                    }
                  : previous
              );
              setMappingEdited(false);
              setNotice(`Mapping reviewed for ${mappingModalDataset.name}.`);
              setMappingModalDataset(null);
            }}
          />
        )}
      </section>
    </div>
  );
}




function DatasetMappingModal({
  dataset,
  columnMapping,
  setColumnMapping,
  detectedColumns,
  missingRequiredMappings,
  mappingEdited,
  onMappingEdited,
  onReset,
  onClose,
  onConfirm,
}: {
  dataset: Dataset;
  columnMapping: DatasetColumnMapping;
  setColumnMapping: Dispatch<SetStateAction<DatasetColumnMapping>>;
  detectedColumns: string[];
  missingRequiredMappings: string[];
  mappingEdited: boolean;
  onMappingEdited: () => void;
  onReset: () => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const canConfirm = missingRequiredMappings.length === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <section className="flex max-h-[88vh] w-full max-w-[900px] flex-col overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#1b1d1f] shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
        <div className="shrink-0 border-b border-white/[0.05] bg-[#111315] px-7 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
                Edit / Review Mapping
              </p>
              <h2 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-white sm:text-[26px]">
                {dataset.name}
              </h2>
              <p className="mt-2 font-mono text-sm text-[#4ad7ff]">
                {dataset.dataset_id}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.08] bg-[#27292a] text-xl font-black text-white transition hover:bg-white/[0.08]"
              aria-label="Close mapping window"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-[18px] border border-white/[0.05] bg-[#222426]/95 p-5">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-[#4ad7ff]">
                Detected Mapping
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a9a9a9]">
                Choose columns from the detected dataset fields. Required fields must be mapped before confirming.
              </p>
            </div>

            <button
              type="button"
              onClick={onReset}
              className="rounded-[10px] border border-white/[0.08] bg-[#27292a] px-4 py-2 text-xs font-black text-white transition hover:bg-white/[0.06]"
            >
              Reset Auto-Mapping
            </button>
          </div>

          <MappingGroup
            title="Required Mapping"
            fields={REQUIRED_MAPPING_FIELDS}
            columnMapping={columnMapping}
            setColumnMapping={setColumnMapping}
            detectedColumns={detectedColumns}
            isRequired
            onMappingEdited={onMappingEdited}
          />

          <MappingGroup
            title="Optional Metadata"
            fields={OPTIONAL_MAPPING_FIELDS}
            columnMapping={columnMapping}
            setColumnMapping={setColumnMapping}
            detectedColumns={detectedColumns}
            isRequired={false}
            onMappingEdited={onMappingEdited}
          />

          {missingRequiredMappings.length > 0 && (
            <div className="mt-5 rounded-[14px] border border-[#ffb347]/25 bg-[#ffb347]/10 p-4 text-sm leading-6 text-[#ffb347]">
              Required mapping is incomplete: {missingRequiredMappings.join(", ")}.
              Choose detected dataset columns before confirming.
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/[0.05] bg-[#16181a]/95 px-7 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 min-w-[110px] rounded-[10px] border border-white/[0.08] bg-[#27292a] px-4 text-xs font-black text-white transition hover:bg-white/[0.06]"
            >
              Close
            </button>

            <div className="flex items-center gap-3">
              {mappingEdited && (
                <span className="hidden text-xs font-bold text-[#4ad7ff] sm:inline">
                  Mapping edited
                </span>
              )}

              <button
                type="button"
                onClick={onConfirm}
                disabled={!canConfirm}
                className="h-10 min-w-[170px] rounded-[10px] bg-[#ff3434] px-4 text-xs font-black text-white transition hover:bg-[#ff4545] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Confirm Mapping
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function DatasetDetailsModal({
  dataset,
  onClose,
}: {
  dataset: Dataset;
  onClose: () => void;
}) {
  const report = dataset.validation_report || null;

  const mapping = normalizeDetectedMapping(
    report?.detected_mapping || dataset.detected_mapping || {}
  );

  const mappingFields = [...REQUIRED_MAPPING_FIELDS, ...OPTIONAL_MAPPING_FIELDS];

  const metricItems = [
    {
      label: "Detected Rows",
      value: String(report?.total_rows_detected ?? dataset.row_count ?? 0),
    },
    {
      label: "Valid Rows",
      value: String(report?.valid_rows ?? dataset.row_count ?? 0),
    },
    {
      label: "Invalid Rows",
      value: String(report?.invalid_rows ?? 0),
    },
    {
      label: "OWASP Coverage",
      value: `${report?.owasp_mapping_coverage_percent ?? 0}%`,
    },
  ];

  async function handleCopyDatasetId() {
    try {
      await navigator.clipboard.writeText(dataset.dataset_id);
    } catch {
      // no-op
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <section className="flex max-h-[88vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#1b1d1f] shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
        <div className="shrink-0 border-b border-white/[0.05] bg-[#111315] px-8 py-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.26em] text-[#4ad7ff]">
                Dataset Details
              </p>
              <h2 className="mt-3 text-[24px] font-black tracking-[-0.04em] text-white sm:text-[28px]">
                {dataset.name}
              </h2>
              <p className="mt-3 font-mono text-lg text-[#4ad7ff]">
                {dataset.dataset_id}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.08] bg-[#27292a] text-2xl font-black text-white transition hover:bg-white/[0.08]"
              aria-label="Close dataset details"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          <div className="rounded-[20px] border border-white/[0.05] bg-[#222426]/95 p-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metricItems.map((item, index) => (
                <div
                  key={item.label}
                  className="rounded-[16px] border border-white/[0.05] bg-[#1a1c1f] px-5 py-5"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.20em] text-[#727272]">
                    {item.label}
                  </p>
                  <p
                    className={`mt-4 font-mono text-[22px] font-black ${
                      index === 1
                        ? "text-[#30d158]"
                        : index === 2
                        ? "text-[#30d158]"
                        : "text-[#4ad7ff]"
                    }`}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[20px] border border-white/[0.05] bg-[#222426]/95 p-6">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-[#4ad7ff]">
              Mapping
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {mappingFields.map((field) => {
                const value = mapping[field.key];
                const displayValue =
                  value && String(value).trim() ? String(value) : "Not mapped";

                return (
                  <div
                    key={String(field.key)}
                    className="rounded-[14px] border border-white/[0.04] bg-[#1a1c1f] px-5 py-4"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#727272]">
                      {field.label}
                    </p>
                    <p className="mt-3 font-mono text-[16px] text-[#4ad7ff]">
                      {displayValue}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/[0.05] bg-[#16181a]/95 px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-[12px] border border-white/[0.08] bg-[#27292a] px-5 text-sm font-black text-white transition hover:bg-white/[0.06]"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleCopyDatasetId}
              className="h-11 rounded-[12px] border border-[#4ad7ff]/25 bg-[#4ad7ff]/10 px-5 text-sm font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/16"
            >
              Copy Dataset ID
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[12px] border border-white/[0.05] bg-[#1f2122] px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#727272]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-black text-white">
        {value}
      </p>
    </div>
  );
}

function MappingGroup({
  title,
  fields,
  columnMapping,
  setColumnMapping,
  detectedColumns,
  isRequired,
  onMappingEdited,
}: {
  title: string;
  fields: { key: keyof DatasetColumnMapping; label: string }[];
  columnMapping: DatasetColumnMapping;
  setColumnMapping: Dispatch<SetStateAction<DatasetColumnMapping>>;
  detectedColumns: string[];
  isRequired: boolean;
  onMappingEdited: () => void;
}) {
  return (
    <div className="mt-4 rounded-[12px] border border-white/[0.05] bg-[#27292a] p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#727272]">
        {title}
      </p>

      {detectedColumns.length === 0 && (
        <p className="mt-3 rounded-[10px] border border-[#ffb347]/25 bg-[#ffb347]/10 px-3 py-2 text-xs font-bold text-[#ffb347]">
          No detected source columns were returned. Re-validate the dataset or check the import source.
        </p>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {fields.map((field) => (
          <Field key={field.key} label={field.label}>
            <MappingSelect
              value={columnMapping[field.key] || ""}
              detectedColumns={detectedColumns}
              required={isRequired}
              onChange={(value) => {
                setColumnMapping((previous) => ({
                  ...previous,
                  [field.key]: value,
                }));
                onMappingEdited();
              }}
            />
          </Field>
        ))}
      </div>
    </div>
  );
}

function MappingSelect({
  value,
  detectedColumns,
  required,
  onChange,
}: {
  value: string;
  detectedColumns: string[];
  required: boolean;
  onChange: (value: string) => void;
}) {
  const options =
    value && !detectedColumns.includes(value)
      ? [value, ...detectedColumns]
      : detectedColumns;

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`h-10 w-full rounded-[10px] border px-3 text-[13px] font-bold text-white outline-none transition focus:border-red-400/70 focus:ring-4 focus:ring-red-500/10 ${
        required && !value
          ? "border-[#ffb347]/45 bg-[#ffb347]/10"
          : "border-white/[0.04] bg-[#1f2122]"
      }`}
    >
      <option value="">
        {required ? "Select detected column" : "None / Not mapped"}
      </option>

      {options.map((column) => (
        <option key={column} value={column}>
          {column}
        </option>
      ))}
    </select>
  );
}

function StepCard({
  title,
  subtitle,
  active,
  completed,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div
      className={`rounded-[14px] border p-4 ${
        active
          ? "border-[#ff3434]/45 bg-[#ff3434]/12"
          : completed
            ? "border-[#30d158]/30 bg-[#30d158]/8"
            : "border-white/[0.06] bg-[#27292a]"
      }`}
    >
      <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#727272]">
        {title}
      </p>
      <p className="mt-1 text-sm font-black text-white">{subtitle}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#727272]">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <input
      value={value}
      type={type}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-[12px] border border-white/[0.04] bg-[#27292a] px-4 text-sm text-white outline-none transition placeholder:text-[#727272] focus:border-red-400/70 focus:ring-4 focus:ring-red-500/10"
    />
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "red" | "cyan" | "green" | "orange";
}) {
  const valueTone = {
    neutral: "text-white",
    red: "text-[#ff3434]",
    cyan: "text-[#4ad7ff]",
    green: "text-[#30d158]",
    orange: "text-[#ffb347]",
  }[tone];

  return (
    <div className="rounded-[16px] border border-white/[0.05] bg-[#27292a]/85 px-4 py-3 text-center shadow-[0_14px_38px_rgba(0,0,0,0.20)]">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#a9a9a9]">
        {label}
      </p>
      <p className={`mt-2 font-mono text-xl font-black ${valueTone}`}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({
  ready,
  children,
}: {
  ready: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-black ${
        ready
          ? "border-emerald-400/25 bg-emerald-500/10 text-[#30d158]"
          : "border-orange-400/25 bg-[#ffb347]/10 text-[#ffb347]"
      }`}
    >
      {children}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const normalized = level.toLowerCase();

  const className =
    normalized === "critical"
      ? "border-[#ff3434]/40 bg-[#ff3434]/15 text-[#ff3434]"
      : normalized === "high"
        ? "border-orange-400/40 bg-orange-500/15 text-[#ffb347]"
        : normalized === "medium"
          ? "border-yellow-400/40 bg-yellow-500/15 text-yellow-100"
          : normalized === "low"
            ? "border-emerald-400/40 bg-emerald-500/15 text-[#30d158]"
            : "border-[#353637] bg-[#1f2122] text-[#d4d4d4]";

  return (
    <span
      className={`rounded-full border px-2 py-1 text-[11px] font-black ${className}`}
    >
      {level}
    </span>
  );
}

function TableHead({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "center" | "right";
}) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align];

  return (
    <th
      className={`px-4 py-3 ${alignClass} text-[10px] font-black uppercase tracking-[0.18em] text-[#a9a9a9]`}
    >
      {children}
    </th>
  );
}

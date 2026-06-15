"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CampaignLibraryItem,
  CampaignLibraryResponse,
  listCampaigns,
} from "@/lib/campaignLibraryApi";

function formatDate(value?: string | null): string {
  if (!value) return "Not available";

  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function progressPercent(item: CampaignLibraryItem): number {
  if (!item.total_tests) return 0;
  return Math.round((item.completed_tests / item.total_tests) * 100);
}

function statusClass(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized === "completed") {
    return "border-emerald-400/30 bg-[#30d158]/10 text-[#30d158]";
  }

  if (normalized === "running" || normalized === "queued") {
    return "border-[#4ad7ff]/30 bg-[#4ad7ff]/10 text-[#4ad7ff]";
  }

  if (normalized === "failed") {
    return "border-[#ff3434]/30 bg-red-400/10 text-[#ff3434]";
  }

  return "border-slate-400/20 bg-slate-400/10 text-[#d4d4d4]";
}

function shortModel(model: string): string {
  return model
    .replace("mock:", "")
    .replace("groq:", "")
    .replace("ollama:", "")
    .replace("openai:", "");
}

export function CampaignBackendLibrary({
  onOpenCampaign,
}: {
  onOpenCampaign?: (campaignId: string) => void | Promise<void>;
}) {
  const [data, setData] = useState<CampaignLibraryResponse | null>(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [openingCampaignId, setOpeningCampaignId] = useState("");

  const campaigns = useMemo(() => data?.items || [], [data]);

  async function handleOpenCampaign(campaignId: string) {
    if (!onOpenCampaign) return;

    setOpeningCampaignId(campaignId);

    try {
      await onOpenCampaign(campaignId);
    } finally {
      setOpeningCampaignId("");
    }
  }

  async function loadLibrary() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await listCampaigns({
        status: status || undefined,
        q: query.trim() || undefined,
        limit: 12,
        offset: 0,
      });

      setData(response);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load campaign library."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLibrary();
    // Load once on mount. Filters are applied by Search/Refresh buttons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="rounded-[22px] border border-white/[0.05] bg-[#27292a] p-5 md:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#4ad7ff]">
            Backend Campaign Library
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Saved Campaign History
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[#a9a9a9]">
            Load campaigns directly from the database, search previous client
            runs, and reopen completed or draft campaigns without depending only
            on browser local storage.
          </p>
        </div>

        <div className="rounded-full border border-emerald-400/30 bg-[#30d158]/10 px-5 py-3 text-sm font-black text-[#30d158]">
          Database Source
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_190px_auto]">
        <div>
          <label className="text-xs font-black uppercase tracking-[0.25em] text-[#727272]">
            Search
          </label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by campaign name, ID, description, or dataset..."
            className="mt-3 w-full rounded-[18px] border border-white/[0.04] bg-[#1f2122] px-4 py-3 text-white outline-none transition placeholder:text-[#727272] focus:border-[#4ad7ff]/50"
          />
        </div>

        <div>
          <label className="text-xs font-black uppercase tracking-[0.25em] text-[#727272]">
            Status
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-3 w-full rounded-[18px] border border-white/[0.04] bg-[#1f2122] px-4 py-3 text-white outline-none transition focus:border-[#4ad7ff]/50"
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="flex items-end gap-3">
          <button
            type="button"
            onClick={loadLibrary}
            disabled={isLoading}
            className="rounded-[18px] border border-[#4ad7ff]/40 px-6 py-4 text-sm font-black text-[#4ad7ff] transition hover:bg-[#4ad7ff]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Search"}
          </button>

          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatus("");
              void listCampaigns({ limit: 12, offset: 0 })
                .then(setData)
                .catch((error) =>
                  setErrorMessage(
                    error instanceof Error
                      ? error.message
                      : "Failed to refresh campaign library."
                  )
                );
            }}
            disabled={isLoading}
            className="rounded-[18px] border border-white/[0.04] px-6 py-4 text-sm font-black text-[#d4d4d4] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-6 rounded-[23px] border border-[#ff3434]/30 bg-[#ff3434]/10 p-5 text-[#ff3434]">
          {errorMessage}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3 text-sm text-[#a9a9a9]">
        <span className="rounded-full border border-white/[0.04] bg-[#303234] px-4 py-2">
          Total matched: {data?.total ?? 0}
        </span>
        <span className="rounded-full border border-white/[0.04] bg-[#303234] px-4 py-2">
          Showing: {campaigns.length}
        </span>
      </div>

      <div className="mt-6 grid gap-4">
        {campaigns.length === 0 && !isLoading ? (
          <div className="rounded-[23px] border border-white/[0.04] bg-[#1f2122] p-8 text-center text-[#a9a9a9]">
            No campaigns found. Try changing the search or status filter.
          </div>
        ) : (
          campaigns.map((campaign) => (
            <article
              key={campaign.campaign_id}
              className="rounded-[23px] border border-white/[0.04] bg-[#1f2122] p-6 transition hover:border-[#4ad7ff]/30"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${statusClass(
                        campaign.status
                      )}`}
                    >
                      {campaign.status}
                    </span>
                    <span className="rounded-full border border-white/[0.04] bg-[#303234] px-3 py-1 font-mono text-xs text-[#a9a9a9]">
                      {campaign.campaign_id}
                    </span>
                  </div>

                  <h3 className="mt-4 break-words text-2xl font-black text-white">
                    {campaign.name}
                  </h3>

                  <p className="mt-2 max-w-4xl text-sm leading-6 text-[#a9a9a9]">
                    {campaign.description || "No description provided."}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#a9a9a9]">
                    <span className="rounded-full border border-white/[0.04] px-3 py-1">
                      Dataset: {campaign.dataset_name || campaign.dataset_id || "N/A"}
                    </span>
                    <span className="rounded-full border border-white/[0.04] px-3 py-1">
                      Rows: {campaign.dataset_row_count ?? "N/A"}
                    </span>
                    <span className="rounded-full border border-white/[0.04] px-3 py-1">
                      Created: {formatDate(campaign.created_at)}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {campaign.selected_models.slice(0, 4).map((model) => (
                      <span
                        key={model}
                        className="rounded-full border border-[#4ad7ff]/20 bg-[#4ad7ff]/10 px-3 py-1 text-xs font-mono text-[#4ad7ff]"
                      >
                        {shortModel(model)}
                      </span>
                    ))}
                    {campaign.selected_models.length > 4 && (
                      <span className="rounded-full border border-white/[0.04] px-3 py-1 text-xs text-[#a9a9a9]">
                        +{campaign.selected_models.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-full shrink-0 xl:w-[280px]">
                  <div className="rounded-[18px] border border-white/[0.04] bg-[#303234] p-4">
                    <div className="flex items-center justify-between text-xs text-[#727272]">
                      <span>Progress</span>
                      <span>{progressPercent(campaign)}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan-300"
                        style={{ width: `${progressPercent(campaign)}%` }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <p className="font-mono text-white">{campaign.total_tests}</p>
                        <p className="text-[#727272]">Total</p>
                      </div>
                      <div>
                        <p className="font-mono text-[#30d158]">
                          {campaign.completed_tests}
                        </p>
                        <p className="text-[#727272]">Done</p>
                      </div>
                      <div>
                        <p className="font-mono text-[#ff3434]">
                          {campaign.failed_tests}
                        </p>
                        <p className="text-[#727272]">Failed</p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleOpenCampaign(campaign.campaign_id)}
                    disabled={openingCampaignId === campaign.campaign_id}
                    className="mt-4 w-full rounded-[18px] bg-cyan-300 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-70"
                  >
                    {openingCampaignId === campaign.campaign_id
                      ? "Opening..."
                      : "Open Campaign"}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

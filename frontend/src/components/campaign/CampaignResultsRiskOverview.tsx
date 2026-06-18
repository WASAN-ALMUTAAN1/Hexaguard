type JsonRecord = Record<string, unknown>;

type CampaignResultsRiskOverviewProps = {
  items: unknown[];
};

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }

  return {};
}

function asString(value: unknown, fallback = "Not available"): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);

  if (Number.isFinite(numberValue)) {
    return numberValue;
  }

  return fallback;
}

function asBooleanLabel(value: unknown): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

function riskRank(level: string): number {
  const normalized = level.toLowerCase();

  if (normalized === "critical") return 4;
  if (normalized === "high") return 3;
  if (normalized === "medium") return 2;
  if (normalized === "low") return 1;

  return 0;
}

function riskTone(level: string): string {
  const normalized = level.toLowerCase();

  if (normalized === "critical") {
    return "border-[#ff3434]/40 bg-[#ff3434]/10 text-[#ff3434]";
  }

  if (normalized === "high") {
    return "border-orange-400/40 bg-[#ffb347]/10 text-[#ffb347]";
  }

  if (normalized === "medium") {
    return "border-yellow-400/40 bg-[#ffd166]/10 text-yellow-100";
  }

  if (normalized === "low") {
    return "border-emerald-400/40 bg-[#30d158]/10 text-[#30d158]";
  }

  return "border-[#353637] bg-[#27292a] text-[#d4d4d4]";
}

function statusTone(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized.includes("passed")) {
    return "border-emerald-400/40 bg-[#30d158]/10 text-[#30d158]";
  }

  if (normalized.includes("failed")) {
    return "border-[#ff3434]/40 bg-[#ff3434]/10 text-[#ff3434]";
  }

  if (normalized.includes("review")) {
    return "border-yellow-400/40 bg-[#ffd166]/10 text-yellow-100";
  }

  return "border-[#353637] bg-[#27292a] text-[#d4d4d4]";
}

function getResultView(item: unknown) {
  const result = asRecord(item);
  const sandboxReport = asRecord(result.sandbox_report);
  const inputEvaluation = asRecord(sandboxReport.input_evaluation);
  const inputRiskMetadata = asRecord(sandboxReport.input_risk_metadata);
  const outputEvaluation = asRecord(
    sandboxReport.output_evaluation || result.ai_evaluation
  );
  const riskAssessment = asRecord(
    sandboxReport.risk_assessment || result.risk_assessment
  );

  const inputRiskLevel = asString(
    inputRiskMetadata.risk_level || inputEvaluation.risk_level,
    "Unknown"
  );

  const outputRiskLevel = asString(
    riskAssessment.severity || riskAssessment.risk_level,
    "Unknown"
  );

  const inputRiskScore = asNumber(
    inputRiskMetadata.risk_score || inputEvaluation.risk_score,
    0
  );

  const outputRiskScore = asNumber(riskAssessment.risk_score, 0);

  const finalStatus = asString(
    result.final_status || sandboxReport.final_status,
    "Unknown"
  );

  const attackSuccess = outputEvaluation.attack_success;

  const attackCategory = asString(
    inputRiskMetadata.attack_category ||
      inputEvaluation.attack_category ||
      result.attack_category,
    "Unknown category"
  );

  const subcategory = asString(
    inputRiskMetadata.subcategory ||
      inputEvaluation.subcategory ||
      result.subcategory,
    "Not specified"
  );

  const owaspCategory = asString(
    inputRiskMetadata.owasp_category ||
      inputEvaluation.owasp_category ||
      result.owasp_category,
    "Not mapped"
  );

  const modelName = asString(result.model_name, "Unknown model");
  const scenarioId = asString(result.scenario_id, "Unknown scenario");
  const mutationType = asString(result.mutation_type, "direct");
  const prompt = asString(result.mutated_prompt || result.input_prompt, "");

  const interpretation =
    riskRank(inputRiskLevel) >= 3 &&
    riskRank(outputRiskLevel) <= 1 &&
    finalStatus.toLowerCase().includes("passed")
      ? "Risky input was handled safely by the model."
      : riskRank(inputRiskLevel) >= 3 && attackSuccess === true
        ? "Risky input appears to have succeeded and needs review."
        : "Review input and output risk together.";

  return {
    inputRiskLevel,
    outputRiskLevel,
    inputRiskScore,
    outputRiskScore,
    finalStatus,
    attackSuccess,
    attackCategory,
    subcategory,
    owaspCategory,
    modelName,
    scenarioId,
    mutationType,
    prompt,
    interpretation,
    inputReason: asString(inputEvaluation.reason, "No input reason available."),
    outputReason: asString(
      outputEvaluation.reasoning,
      "No output reasoning available."
    ),
    metadataSource: asString(
      inputRiskMetadata.metadata_source || inputEvaluation.metadata_source,
      "Not available"
    ),
  };
}

function MetricTile({
  label,
  value,
  tone = "border-[#353637] bg-[#1f2122] text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className={`rounded-[18px] border p-4 ${tone}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}

function RiskBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className={`rounded-[14px] border px-3 py-2 ${riskTone(value)}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function ResultRiskCard({ item, index }: { item: unknown; index: number }) {
  const view = getResultView(item);

  return (
    <article className="rounded-[20px] border border-[#353637] bg-[#1f2122]/80 p-4 shadow-xl shadow-cyan-950/10">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#4ad7ff]">
            Result #{index + 1}
          </p>
          <h3 className="mt-2 text-lg font-black text-white">
            {view.scenarioId} · {view.attackCategory}
          </h3>
          <p className="mt-1 text-sm text-[#a9a9a9]">
            Model: {view.modelName} · Mutation: {view.mutationType}
          </p>
        </div>

        <div
          className={`rounded-[18px] border px-4 py-3 text-sm font-black ${statusTone(
            view.finalStatus
          )}`}
        >
          {view.finalStatus}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricTile
          label="Input Risk"
          value={`${view.inputRiskLevel} (${view.inputRiskScore})`}
          tone={riskTone(view.inputRiskLevel)}
        />

        <MetricTile
          label="Model Output Risk"
          value={`${view.outputRiskLevel} (${view.outputRiskScore})`}
          tone={riskTone(view.outputRiskLevel)}
        />

        <MetricTile
          label="Attack Success"
          value={asBooleanLabel(view.attackSuccess)}
          tone={
            view.attackSuccess === true
              ? "border-[#ff3434]/40 bg-[#ff3434]/10 text-[#ff3434]"
              : view.attackSuccess === false
                ? "border-emerald-400/40 bg-[#30d158]/10 text-[#30d158]"
                : "border-[#353637] bg-[#27292a] text-[#d4d4d4]"
          }
        />

        <MetricTile
          label="Decision"
          value={view.interpretation}
          tone="border-[#4ad7ff]/30 bg-[#4ad7ff]/10 text-[#4ad7ff]"
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <RiskBadge label="OWASP / Safety Mapping" value={view.owaspCategory} />
        <RiskBadge label="Subcategory" value={view.subcategory} />
        <RiskBadge label="Metadata Source" value={view.metadataSource} />
      </div>

      <div className="mt-5 rounded-[16px] border border-[#353637] bg-[#27292a]/70 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#727272]">
          Prompt Preview
        </p>
        <p className="mt-2 line-clamp-4 text-sm leading-6 text-[#d4d4d4]">
          {view.prompt}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[16px] border border-[#353637] bg-[#27292a]/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#727272]">
            Input Risk Reason
          </p>
          <p className="mt-2 text-sm leading-6 text-[#d4d4d4]">
            {view.inputReason}
          </p>
        </div>

        <div className="rounded-[16px] border border-[#353637] bg-[#27292a]/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#727272]">
            Output Evaluation Reason
          </p>
          <p className="mt-2 text-sm leading-6 text-[#d4d4d4]">
            {view.outputReason}
          </p>
        </div>
      </div>
    </article>
  );
}

export function CampaignResultsRiskOverview({
  items,
}: CampaignResultsRiskOverviewProps) {
  if (!items.length) {
    return null;
  }

  const enrichedItems = items.map(getResultView);

  const criticalInputs = enrichedItems.filter(
    (item) => item.inputRiskLevel.toLowerCase() === "critical"
  ).length;

  const highInputs = enrichedItems.filter(
    (item) => item.inputRiskLevel.toLowerCase() === "high"
  ).length;

  const passedResults = enrichedItems.filter((item) =>
    item.finalStatus.toLowerCase().includes("passed")
  ).length;

  const successfulAttacks = enrichedItems.filter(
    (item) => item.attackSuccess === true
  ).length;

  return (
    <section className="mt-8 rounded-[23px] border border-[#353637] bg-[#27292a]/40 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#4ad7ff]">
            Campaign Result Visualization
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Input Risk vs Model Output Risk
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a9a9a9]">
            This separates the danger of the test prompt from the model response.
            A result can have Critical input risk and still pass if the model
            refuses safely.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricTile
          label="Critical Inputs"
          value={String(criticalInputs)}
          tone="border-[#ff3434]/40 bg-[#ff3434]/10 text-[#ff3434]"
        />
        <MetricTile
          label="High Inputs"
          value={String(highInputs)}
          tone="border-orange-400/40 bg-[#ffb347]/10 text-[#ffb347]"
        />
        <MetricTile
          label="Passed Results"
          value={String(passedResults)}
          tone="border-emerald-400/40 bg-[#30d158]/10 text-[#30d158]"
        />
        <MetricTile
          label="Successful Attacks"
          value={String(successfulAttacks)}
          tone={
            successfulAttacks > 0
              ? "border-[#ff3434]/40 bg-[#ff3434]/10 text-[#ff3434]"
              : "border-emerald-400/40 bg-[#30d158]/10 text-[#30d158]"
          }
        />
      </div>

      <div className="mt-6 space-y-5">
        {items.map((item, index) => (
          <ResultRiskCard
            key={`${asString(asRecord(item).id, String(index))}-${index}`}
            item={item}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}

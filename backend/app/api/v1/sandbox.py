import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from app.core.access_control import verify_user_access
from app.services.ai_engine.connectors import get_model_connector
from app.services.ai_engine.datasets import (
    load_user_csv,
    load_user_json,
    load_huggingface_dataset,
    load_kaggle_dataset,
    load_dataset_from_url,
)
from app.services.ai_engine.evaluator import HexaguardEvaluator
from app.services.ai_engine.judge import evaluate_with_judge
from app.services.ai_engine.schemas import (
    Message,
    FinalEvaluationReport,
    ModelComparisonResult,
    DatasetBatchResponse,
)


router = APIRouter(prefix="/sandbox", tags=["HEXAGUARD Sandbox"])


class SandboxRequest(BaseModel):
    prompt: str
    model_name: str
    scenario: str

    context: Optional[str] = None
    history: Optional[List[Message]] = None

    custom_key: Optional[str] = None
    custom_endpoint: Optional[str] = None

    expected_behavior: Optional[str] = None
    failure_condition: Optional[str] = None

    user_id: str = "sys_user_01"


class ComparisonRequest(BaseModel):
    prompt: str
    models: List[str]
    scenario: str

    context: Optional[str] = None
    history: Optional[List[Message]] = None

    custom_key: Optional[str] = None
    custom_endpoint: Optional[str] = None

    expected_behavior: Optional[str] = None
    failure_condition: Optional[str] = None

    user_id: str = "sys_user_01"


class HuggingFaceBatchRequest(BaseModel):
    dataset_path: str
    split: str = "test"
    limit: int = 20
    model_name: str = "mock:mock-safe-model"
    user_id: str = "sys_user_01"


class KaggleBatchRequest(BaseModel):
    kaggle_dataset: str
    limit: int = 20
    model_name: str = "mock:mock-safe-model"
    user_id: str = "sys_user_01"


class URLBatchRequest(BaseModel):
    dataset_url: str
    limit: int = 20
    model_name: str = "mock:mock-safe-model"
    user_id: str = "sys_user_01"


def parse_model_name(model_name: str):
    if ":" not in model_name:
        return "mock", model_name
    provider, model_id = model_name.split(":", 1)
    return provider.strip().lower(), model_id.strip()


def classify_access_type(provider: str) -> str:
    provider = provider.lower().strip()

    paid = {
        "openai",
        "anthropic",
        "gemini",
        "groq",
        "huggingface",
        "openrouter",
        "together",
        "replicate",
        "azure-openai",
        "aws-bedrock",
        "vertex-ai",
    }

    local = {
        "ollama",
        "lmstudio",
        "llama.cpp",
    }

    user_added = {
        "custom",
        "openai-compatible",
    }

    free = {
        "mock",
        "rule-based",
        "dataset",
    }

    if provider in paid:
        return "paid"
    if provider in local:
        return "local"
    if provider in user_added:
        return "user-added"
    if provider in free:
        return "free"

    return "user-added"


async def _run_single_evaluation(request: SandboxRequest) -> FinalEvaluationReport:
    provider, model_id = parse_model_name(request.model_name)
    access_type = classify_access_type(provider)

    await verify_user_access(
        user_id=request.user_id,
        provider=provider,
        access_type=access_type,
        custom_key=request.custom_key,
        custom_endpoint=request.custom_endpoint,
    )

    evaluator = HexaguardEvaluator(
        provider=provider,
        model=model_id,
        access_type=access_type,
        scenario=request.scenario,
    )

    connector = get_model_connector(provider)

    return await evaluator.run_full_evaluation(
        prompt=request.prompt,
        context=request.context,
        history=request.history,
        target_connector_func=lambda p, c, h: connector.generate(
            prompt=p,
            model=model_id,
            context=c,
            history=h,
            api_key=request.custom_key,
            endpoint=request.custom_endpoint,
        ),
        judge_func=evaluate_with_judge,
        expected_behavior=request.expected_behavior,
        failure_condition=request.failure_condition,
    )


@router.post("/run", response_model=FinalEvaluationReport)
async def run_sandbox(request: SandboxRequest):
    try:
        return await _run_single_evaluation(request)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"HEXAGUARD Engine Error: {str(error)}",
        )


@router.post("/compare", response_model=ModelComparisonResult)
async def run_comparison(request: ComparisonRequest):
    if not request.models:
        raise HTTPException(status_code=400, detail="At least one model is required.")

    results = {}

    for model_name in request.models:
        single_request = SandboxRequest(
            prompt=request.prompt,
            model_name=model_name,
            scenario=request.scenario,
            context=request.context,
            history=request.history,
            custom_key=request.custom_key,
            custom_endpoint=request.custom_endpoint,
            expected_behavior=request.expected_behavior,
            failure_condition=request.failure_condition,
            user_id=request.user_id,
        )

        report = await _run_single_evaluation(single_request)
        results[model_name] = report

    def risk_sort_key(model_name: str):
        report = results[model_name]
        refusal_rank = {"Failed": 3, "Weak": 2, "None": 1, "Strong": 0}
        return (
            report.risk_assessment.risk_score,
            1 if report.output_evaluation.attack_success else 0,
            refusal_rank.get(report.output_evaluation.refusal_quality, 1),
        )

    sorted_by_risk = sorted(results.keys(), key=risk_sort_key, reverse=True)

    highest_risk_model = sorted_by_risk[0]
    lowest_risk_model = sorted_by_risk[-1]

    fastest_model = min(
        results.keys(),
        key=lambda model: results[model].model_response.latency_ms
        if results[model].model_response.latency_ms > 0
        else 999999999,
    )

    cheapest_model = min(
        results.keys(),
        key=lambda model: results[model].model_response.estimated_cost
        if results[model].model_response.estimated_cost is not None
        else 999999999.0,
    )

    failed_models = [
        model
        for model, report in results.items()
        if report.output_evaluation.attack_success
        or report.output_evaluation.sensitive_data_leaked
        or report.output_evaluation.unsafe_output_detected
        or report.output_evaluation.tool_misuse_detected
        or report.output_evaluation.rag_injection_success
    ]

    risk_scores = {
        model: report.risk_assessment.risk_score
        for model, report in results.items()
    }

    min_risk = min(risk_scores.values())
    max_risk = max(risk_scores.values())

    safest_models = [model for model, score in risk_scores.items() if score == min_risk]
    riskiest_models = [model for model, score in risk_scores.items() if score == max_risk]

    if min_risk == max_risk and not failed_models:
        lowest_risk_model = "Tie: " + ", ".join(safest_models)
        highest_risk_model = "Tie: " + ", ".join(riskiest_models)
        safest_summary = (
            "All tested models achieved the same risk score and no model failed the attack scenario."
        )
        risk_summary = "No clear worst model was identified. Failed models: None."
    else:
        safest_summary = (
            f"{lowest_risk_model} had the lowest risk score and showed the strongest safety behavior."
        )
        risk_summary = (
            f"{highest_risk_model} had the highest risk score. "
            f"Failed models: {', '.join(failed_models) if failed_models else 'None'}."
        )

    return ModelComparisonResult(
        best_model=lowest_risk_model,
        worst_model=highest_risk_model,
        lowest_risk_model=lowest_risk_model,
        highest_risk_model=highest_risk_model,
        fastest_model=fastest_model,
        cheapest_model=cheapest_model,
        safest_summary=safest_summary,
        risk_summary=risk_summary,
        results={name: report.model_dump() for name, report in results.items()},
    )


async def _run_dataset_rows(rows, model_name: str, user_id: str):
    reports = []

    for row in rows:
        request = SandboxRequest(
            prompt=row.prompt,
            model_name=model_name,
            scenario=row.attack_scenario,
            context=row.context,
            expected_behavior=row.expected_behavior,
            failure_condition=row.failure_condition,
            user_id=user_id,
        )

        report = await _run_single_evaluation(request)
        report_dict = report.model_dump()
        report_dict["dataset_row"] = row.model_dump()
        reports.append(report_dict)

    return reports


@router.post("/dataset/upload", response_model=DatasetBatchResponse)
async def run_uploaded_dataset_batch(
    file: UploadFile = File(...),
    model_name: str = "mock:mock-safe-model",
    user_id: str = "sys_user_01",
):
    try:
        content_bytes = await file.read()
        content = content_bytes.decode("utf-8")

        if file.filename.lower().endswith(".json"):
            rows = load_user_json(content)
        else:
            rows = load_user_csv(content)

        reports = await _run_dataset_rows(rows, model_name, user_id)

        return DatasetBatchResponse(
            batch_id=f"HXG-UPLOAD-{str(uuid.uuid4())[:8].upper()}",
            total_scanned=len(reports),
            model_name=model_name,
            reports=reports,
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"HEXAGUARD Dataset Upload Error: {str(error)}",
        )


@router.post("/dataset/huggingface", response_model=DatasetBatchResponse)
async def run_huggingface_dataset_batch(request: HuggingFaceBatchRequest):
    try:
        rows = await load_huggingface_dataset(
            dataset_path=request.dataset_path,
            split=request.split,
            limit=request.limit,
        )

        reports = await _run_dataset_rows(rows, request.model_name, request.user_id)

        return DatasetBatchResponse(
            batch_id=f"HXG-HF-{str(uuid.uuid4())[:8].upper()}",
            total_scanned=len(reports),
            model_name=request.model_name,
            reports=reports,
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"HEXAGUARD HuggingFace Dataset Error: {str(error)}",
        )


@router.post("/dataset/kaggle", response_model=DatasetBatchResponse)
async def run_kaggle_dataset_batch(request: KaggleBatchRequest):
    try:
        rows = await load_kaggle_dataset(
            kaggle_dataset=request.kaggle_dataset,
            limit=request.limit,
        )

        reports = await _run_dataset_rows(rows, request.model_name, request.user_id)

        return DatasetBatchResponse(
            batch_id=f"HXG-KAGGLE-{str(uuid.uuid4())[:8].upper()}",
            total_scanned=len(reports),
            model_name=request.model_name,
            reports=reports,
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"HEXAGUARD Kaggle Dataset Error: {str(error)}",
        )


@router.post("/dataset/url", response_model=DatasetBatchResponse)
async def run_url_dataset_batch(request: URLBatchRequest):
    try:
        rows = await load_dataset_from_url(
            url=request.dataset_url,
            limit=request.limit,
        )

        reports = await _run_dataset_rows(rows, request.model_name, request.user_id)

        return DatasetBatchResponse(
            batch_id=f"HXG-URL-{str(uuid.uuid4())[:8].upper()}",
            total_scanned=len(reports),
            model_name=request.model_name,
            reports=reports,
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"HEXAGUARD URL Dataset Error: {str(error)}",
        )
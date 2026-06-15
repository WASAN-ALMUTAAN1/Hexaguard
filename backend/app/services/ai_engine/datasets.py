import csv
import json
from typing import List, Optional
from pathlib import Path

import httpx
from datasets import load_dataset

from app.services.ai_engine.schemas import DatasetRow


def _safe_get(row, keys, default=""):
    for key in keys:
        if key in row and row[key] not in [None, ""]:
            return row[key]
    return default


async def load_huggingface_dataset(
    dataset_path: str,
    split: str = "test",
    limit: int = 50,
    source_url: Optional[str] = None,
) -> List[DatasetRow]:
    ds = load_dataset(dataset_path, split=split)

    if limit:
        ds = ds.select(range(min(limit, len(ds))))

    rows = []

    for index, row in enumerate(ds):
        prompt = _safe_get(row, ["prompt", "instruction", "question", "input", "text", "query"])
        context = _safe_get(row, ["context", "document", "passage", "source", "email", "webpage"], None)

        attack_type = _safe_get(
            row,
            ["attack_type", "type", "category", "label", "prompt_type"],
            "General",
        )

        expected_behavior = _safe_get(
            row,
            ["expected_behavior", "safe_behavior", "target", "answer"],
            "The model should respond safely and refuse unsafe or unauthorized behavior.",
        )

        failure_condition = _safe_get(
            row,
            ["failure_condition", "failure", "unsafe_behavior"],
            "The model follows malicious instructions, leaks sensitive information, or produces unsafe output.",
        )

        labels_raw = _safe_get(row, ["labels", "tags"], [])
        labels = [labels_raw] if isinstance(labels_raw, str) else labels_raw or []

        rows.append(
            DatasetRow(
                row_id=str(_safe_get(row, ["id", "row_id"], str(index))),
                source_name=dataset_path,
                source_url=source_url or f"https://huggingface.co/datasets/{dataset_path}",
                attack_scenario=str(attack_type),
                attack_type=str(attack_type),
                prompt=str(prompt),
                context=str(context) if context else None,
                labels=labels,
                expected_behavior=str(expected_behavior),
                failure_condition=str(failure_condition),
                owasp_mapping=[],
                severity_weight=0,
                blue_team_recommendation=[],
            )
        )

    return rows


async def load_kaggle_dataset(
    kaggle_dataset: str,
    limit: int = 50,
) -> List[DatasetRow]:
    import kagglehub

    path = kagglehub.dataset_download(kaggle_dataset)
    base_path = Path(path)

    candidate_files = list(base_path.glob("*.csv")) + list(base_path.glob("*.json"))
    if not candidate_files:
        raise ValueError("No CSV or JSON files found in Kaggle dataset.")

    first_file = candidate_files[0]
    content = first_file.read_text(encoding="utf-8")

    if first_file.suffix.lower() == ".json":
        rows = load_user_json(content, source_name=kaggle_dataset)
    else:
        rows = load_user_csv(content, source_name=kaggle_dataset)

    return rows[:limit]


async def load_dataset_from_url(url: str, limit: int = 50) -> List[DatasetRow]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()

    content = response.text

    if url.lower().endswith(".json") or content.strip().startswith("[") or content.strip().startswith("{"):
        rows = load_user_json(content, source_name=url)
    else:
        rows = load_user_csv(content, source_name=url)

    return rows[:limit]


def load_user_csv(file_content: str, source_name: str = "user-upload") -> List[DatasetRow]:
    reader = csv.DictReader(file_content.splitlines())
    rows = []

    for index, row in enumerate(reader):
        rows.append(
            DatasetRow(
                row_id=row.get("row_id") or row.get("id") or str(index),
                source_name=row.get("source_name") or source_name,
                source_url=row.get("source_url") or None,
                attack_scenario=row.get("attack_scenario") or row.get("scenario") or "General",
                attack_type=row.get("attack_type") or row.get("type") or "Unknown",
                prompt=row.get("prompt") or "",
                context=row.get("context") or None,
                labels=[
                    item.strip()
                    for item in (row.get("labels") or "").split(",")
                    if item.strip()
                ],
                expected_behavior=row.get("expected_behavior")
                or "The model should respond safely and refuse unsafe behavior.",
                failure_condition=row.get("failure_condition")
                or "The model follows malicious instructions or produces unsafe output.",
                owasp_mapping=[
                    item.strip()
                    for item in (row.get("owasp_mapping") or "").split(",")
                    if item.strip()
                ],
                severity_weight=int(row.get("severity_weight") or 0),
                blue_team_recommendation=[
                    item.strip()
                    for item in (row.get("blue_team_recommendation") or "").split("|")
                    if item.strip()
                ],
            )
        )

    return rows


def load_user_json(file_content: str, source_name: str = "user-upload") -> List[DatasetRow]:
    data = json.loads(file_content)

    if isinstance(data, dict):
        data = data.get("rows", [])

    rows = []
    for index, row in enumerate(data):
        row.setdefault("row_id", str(index))
        row.setdefault("source_name", source_name)
        rows.append(DatasetRow(**row))

    return rows
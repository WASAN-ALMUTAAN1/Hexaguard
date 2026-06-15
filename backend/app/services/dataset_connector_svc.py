import csv
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import httpx
from fastapi import HTTPException
from app.services.security_modules.dataset_row_sanitizer import sanitize_dataset_rows_for_db
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dataset import UploadedDataset
from app.models.dataset_row import DatasetRow
from app.schemas.dataset import DatasetImportRequest
from app.services.dataset_auto_mapper_svc import get_best_dataset_mapping
from app.services.security_modules.input_risk_detector import (
    normalize_dataset_risk_fields,
)


HF_DATASETS_SERVER = "https://datasets-server.huggingface.co"


PROMPT_CANDIDATES = [
    "prompt",
    "instruction",
    "input",
    "question",
    "text",
    "query",
    "user_prompt",
    "content",
    "message",
    "user_message",
    "contestant_message",
    "submission_message",
    "conversation",
    "response_prompt",
    "red_team_prompt",
    "jailbreak_prompt",
]

ROW_ID_CANDIDATES = [
    "id",
    "row_id",
    "prompt_id",
    "case_id",
    "test_id",
    "example_id",
]

ATTACK_CATEGORY_CANDIDATES = [
    "attack_category",
    "category",
    "attack_type",
    "type",
    "label",
    "risk_category",
]

SEVERITY_CANDIDATES = [
    "severity",
    "risk_level",
    "risk",
    "priority",
]

RISK_LEVEL_CANDIDATES = [
    "risk_level",
    "risk",
    "severity",
    "priority",
]

SUBCATEGORY_CANDIDATES = [
    "subcategory",
    "sub_category",
    "harm_type",
    "risk_subcategory",
]

OWASP_CANDIDATES = [
    "owasp_category",
    "owasp",
    "owasp_mapping",
    "llm_top_10",
]

EXPECTED_CANDIDATES = [
    "expected_safe_behavior",
    "expected",
    "expected_behavior",
    "safe_behavior",
    "description",
]

LANGUAGE_CANDIDATES = [
    "language",
    "lang",
]

TAGS_CANDIDATES = [
    "tags",
    "tag",
]


def _new_dataset_id() -> str:
    return f"HXG-DS-{str(uuid.uuid4())[:8].upper()}"


def _normalize_column_name(value: str) -> str:
    return value.strip().lower().replace("-", "_").replace(" ", "_")


def _find_column(columns: list[str], candidates: list[str]) -> str | None:
    normalized = {_normalize_column_name(column): column for column in columns}

    for candidate in candidates:
        if candidate in normalized:
            return normalized[candidate]

    for column in columns:
        column_norm = _normalize_column_name(column)

        for candidate in candidates:
            if candidate in column_norm:
                return column

    return None


def _mapping_to_dict(mapping: Any) -> dict[str, str | None]:
    if mapping is None:
        return {}

    if hasattr(mapping, "model_dump"):
        data = mapping.model_dump()
    elif isinstance(mapping, dict):
        data = mapping
    else:
        data = {}

    cleaned: dict[str, str | None] = {}

    for key, value in data.items():
        if value is None:
            cleaned[key] = None
        else:
            text = str(value).strip()
            cleaned[key] = text or None

    return cleaned


def _detect_mapping(
    rows: list[dict[str, Any]],
    requested_mapping: Any = None,
) -> dict[str, str | None]:
    columns = list(rows[0].keys()) if rows else []
    requested = _mapping_to_dict(requested_mapping)

    auto = {
        "prompt": _find_column(columns, PROMPT_CANDIDATES),
        "row_id": _find_column(columns, ROW_ID_CANDIDATES),
        "attack_category": _find_column(columns, ATTACK_CATEGORY_CANDIDATES),
        "severity": _find_column(columns, SEVERITY_CANDIDATES),
        "risk_level": _find_column(columns, RISK_LEVEL_CANDIDATES),
        "subcategory": _find_column(columns, SUBCATEGORY_CANDIDATES),
        "owasp_category": _find_column(columns, OWASP_CANDIDATES),
        "expected_safe_behavior": _find_column(columns, EXPECTED_CANDIDATES),
        "language": _find_column(columns, LANGUAGE_CANDIDATES),
        "tags": _find_column(columns, TAGS_CANDIDATES),
    }

    for key, value in requested.items():
        if value:
            auto[key] = value

    return auto


def _get_value(row: dict[str, Any], column: str | None) -> Any:
    if not column:
        return None

    if column in row:
        return row[column]

    normalized_target = _normalize_column_name(column)

    for key, value in row.items():
        if _normalize_column_name(key) == normalized_target:
            return value

    return None


def _split_tags(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    text = str(value).strip()

    if not text:
        return []

    try:
        parsed = json.loads(text)

        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except Exception:
        pass

    return [item.strip() for item in text.split(",") if item.strip()]


def _parse_csv_bytes(content: bytes, max_rows: int) -> list[dict[str, Any]]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    rows: list[dict[str, Any]] = []

    for index, row in enumerate(reader):
        if index >= max_rows:
            break

        rows.append(dict(row))

    return rows


def _parse_json_bytes(content: bytes, max_rows: int) -> list[dict[str, Any]]:
    text = content.decode("utf-8", errors="replace")
    data = json.loads(text)

    if isinstance(data, list):
        rows = data
    elif isinstance(data, dict):
        if isinstance(data.get("rows"), list):
            rows = data["rows"]
        elif isinstance(data.get("data"), list):
            rows = data["data"]
        elif isinstance(data.get("items"), list):
            rows = data["items"]
        else:
            rows = [data]
    else:
        rows = []

    normalized: list[dict[str, Any]] = []

    for item in rows[:max_rows]:
        if isinstance(item, dict):
            normalized.append(item)
        else:
            normalized.append({"prompt": str(item)})

    return normalized


def _rows_to_csv_bytes(rows: list[dict[str, Any]]) -> bytes:
    if not rows:
        return b""

    all_columns: list[str] = []

    for row in rows:
        for key in row.keys():
            if key not in all_columns:
                all_columns.append(key)

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=all_columns)
    writer.writeheader()

    for row in rows:
        writer.writerow({column: row.get(column, "") for column in all_columns})

    return buffer.getvalue().encode("utf-8")


def _parse_huggingface_source(source_uri: str) -> tuple[str, str | None, str | None]:
    source = source_uri.strip()

    if source.startswith("http"):
        parsed = urlparse(source)
        query = parse_qs(parsed.query)

        parts = [part for part in parsed.path.split("/") if part]

        if "datasets" in parts:
            dataset_index = parts.index("datasets") + 1
            dataset = "/".join(parts[dataset_index : dataset_index + 2])
        else:
            dataset = "/".join(parts[:2])

        config = query.get("config", [None])[0]
        split = query.get("split", [None])[0]

        return unquote(dataset), config, split

    # Supported formats:
    # owner/dataset
    # owner/dataset:config
    # owner/dataset:config:split
    parts = source.split(":")

    dataset = parts[0]
    config = parts[1] if len(parts) >= 2 and parts[1] else None
    split = parts[2] if len(parts) >= 3 and parts[2] else None

    return dataset, config, split


async def _resolve_hf_config_split(
    client: httpx.AsyncClient,
    dataset: str,
    config: str | None,
    split: str | None,
    headers: dict[str, str],
) -> tuple[str, str]:
    if config and split:
        return config, split

    response = await client.get(
        f"{HF_DATASETS_SERVER}/splits",
        params={"dataset": dataset},
        headers=headers,
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"HuggingFace split discovery failed with status {response.status_code}.",
        )

    data = response.json()
    splits = data.get("splits", [])

    if not splits:
        raise HTTPException(
            status_code=400,
            detail="No readable HuggingFace splits were found for this dataset.",
        )

    selected = splits[0]

    resolved_config = config or selected.get("config")
    resolved_split = split or selected.get("split")

    if not resolved_config or not resolved_split:
        raise HTTPException(
            status_code=400,
            detail="Could not resolve HuggingFace config/split. Provide source_uri as owner/dataset:config:split.",
        )

    return resolved_config, resolved_split


async def _fetch_huggingface_rows(
    source_uri: str,
    max_rows: int,
    hf_token: str | None = None,
) -> tuple[list[dict[str, Any]], str]:
    dataset, config, split = _parse_huggingface_source(source_uri)

    token = hf_token or os.getenv("HF_API_KEY") or os.getenv("HUGGINGFACE_TOKEN")
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    async with httpx.AsyncClient(timeout=60.0) as client:
        resolved_config, resolved_split = await _resolve_hf_config_split(
            client=client,
            dataset=dataset,
            config=config,
            split=split,
            headers=headers,
        )

        response = await client.get(
            f"{HF_DATASETS_SERVER}/rows",
            params={
                "dataset": dataset,
                "config": resolved_config,
                "split": resolved_split,
                "offset": 0,
                "length": max_rows,
            },
            headers=headers,
        )

        if response.status_code != 200:
            # Some datasets work better with first-rows.
            response = await client.get(
                f"{HF_DATASETS_SERVER}/first-rows",
                params={
                    "dataset": dataset,
                    "config": resolved_config,
                    "split": resolved_split,
                },
                headers=headers,
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"HuggingFace dataset fetch failed with status {response.status_code}.",
            )

        data = response.json()
        raw_rows = data.get("rows", [])

        rows: list[dict[str, Any]] = []

        for item in raw_rows[:max_rows]:
            if isinstance(item, dict) and isinstance(item.get("row"), dict):
                rows.append(item["row"])
            elif isinstance(item, dict):
                rows.append(item)

        filename = f"{dataset.replace('/', '__')}_{resolved_split}.csv"

        return rows, filename


def _parse_kaggle_slug(source_uri: str) -> str:
    source = source_uri.strip()

    if source.startswith("http"):
        parsed = urlparse(source)
        parts = [part for part in parsed.path.split("/") if part]

        if "datasets" in parts:
            index = parts.index("datasets") + 1
            slug = "/".join(parts[index : index + 2])
        else:
            slug = "/".join(parts[:2])

        return slug

    return source


def _select_kaggle_file(
    download_path: str,
    preferred_file_path: str | None = None,
) -> Path:
    path = Path(download_path).resolve()

    if preferred_file_path:
        preferred = (path / preferred_file_path).resolve()

        if not str(preferred).startswith(str(path)):
            raise HTTPException(
                status_code=400,
                detail="Invalid Kaggle file path. It must be inside the downloaded dataset folder.",
            )

        if not preferred.exists() or not preferred.is_file():
            raise HTTPException(
                status_code=400,
                detail=f"Requested Kaggle file was not found: {preferred_file_path}",
            )

        if preferred.suffix.lower() not in {".csv", ".json"}:
            raise HTTPException(
                status_code=400,
                detail="Requested Kaggle file must be CSV or JSON.",
            )

        return preferred

    if path.is_file() and path.suffix.lower() in {".csv", ".json"}:
        if path.name.lower() != "kaggle.json":
            return path

    candidates = []

    for item in path.rglob("*"):
        if not item.is_file():
            continue

        if item.suffix.lower() not in {".csv", ".json"}:
            continue

        # Never import credential/config files.
        if item.name.lower() == "kaggle.json":
            continue

        # Skip hidden/system folders.
        if any(part.startswith(".") for part in item.parts):
            continue

        candidates.append(item)

    if not candidates:
        raise HTTPException(
            status_code=400,
            detail=(
                "Kaggle dataset downloaded, but no usable CSV or JSON dataset file was found. "
                "If the dataset contains multiple files, provide kaggle_file_path."
            ),
        )

    # Prefer likely prompt datasets, otherwise choose the smallest readable data file.
    def score(file_path: Path):
        name = file_path.name.lower()
        prompt_bonus = 0 if any(
            keyword in name
            for keyword in ["prompt", "jailbreak", "red", "attack", "question", "instruction", "text"]
        ) else 1

        return (prompt_bonus, file_path.stat().st_size)

    candidates.sort(key=score)
    return candidates[0]



def _fetch_kaggle_rows(
    source_uri: str,
    max_rows: int,
    kaggle_username: str | None = None,
    kaggle_key: str | None = None,
    kaggle_api_token: str | None = None,
    kaggle_file_path: str | None = None,
):
    """
    Professional Kaggle behavior:
    - If credentials are provided, use authenticated Kaggle API.
    - If credentials are not provided, try public Kaggle download first.
    - If Kaggle blocks public download, ask for credentials only then.
    """
    import csv
    import io
    import json
    import os
    import re
    import tempfile
    import zipfile
    from pathlib import Path
    from urllib.error import HTTPError, URLError
    from urllib.request import Request, urlopen

    from fastapi import HTTPException

    def normalize_slug(value: str) -> str:
        value = (value or "").strip().strip("\"'`").strip()

        url_match = re.search(
            r"https?://(?:www\.)?kaggle\.com/datasets/([^?#\s]+/[^?#\s/]+)",
            value,
        )
        if url_match:
            return url_match.group(1)

        download_match = re.search(
            r"kagglehub\.dataset_download\(\s*[\"']([^\"']+)[\"']",
            value,
        )
        if download_match:
            return download_match.group(1)

        load_match = re.search(
            r"[\"']([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)[\"']",
            value,
        )
        if "kagglehub.load_dataset" in value and load_match:
            return load_match.group(1)

        return value

    def load_file_rows(file_path: Path, limit: int):
        suffix = file_path.suffix.lower()

        if suffix == ".csv":
            with file_path.open("r", encoding="utf-8-sig", newline="") as handle:
                reader = csv.DictReader(handle)
                return [dict(row) for _, row in zip(range(limit), reader)], "csv"

        if suffix == ".json":
            with file_path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)

            if isinstance(data, list):
                rows = data
            elif isinstance(data, dict):
                rows = None
                for key in ["data", "rows", "items", "records", "train"]:
                    if isinstance(data.get(key), list):
                        rows = data[key]
                        break
                if rows is None:
                    rows = [data]
            else:
                rows = []

            return [
                row if isinstance(row, dict) else {"value": row}
                for row in rows[:limit]
            ], "json"

        raise HTTPException(
            status_code=400,
            detail=f"Unsupported Kaggle file type '{suffix}'. Only CSV and JSON are supported.",
        )

    def select_file(directory: Path, requested_path: str | None):
        requested_path = (requested_path or "").strip()

        if requested_path:
            candidate = directory / requested_path
            if candidate.exists() and candidate.is_file():
                return candidate

            raise HTTPException(
                status_code=400,
                detail="The provided kaggle_file_path was not found inside the downloaded dataset.",
            )

        files = [
            item
            for item in directory.rglob("*")
            if item.is_file()
            and item.name.lower() != "kaggle.json"
            and item.suffix.lower() in {".csv", ".json"}
            and not item.name.startswith(".")
        ]

        if not files:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Kaggle dataset was downloaded, but no CSV or JSON file was found. "
                    "If the dataset has multiple or nested files, provide kaggle_file_path."
                ),
            )

        files.sort(key=lambda item: item.stat().st_size, reverse=True)
        return files[0]

    def read_downloaded_content(content: bytes, content_type: str, slug: str):
        if not content:
            raise HTTPException(
                status_code=400,
                detail="Kaggle returned an empty dataset download response.",
            )

        lowered_start = content[:200].lower()
        if b"<html" in lowered_start or b"<!doctype html" in lowered_start:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Kaggle returned an HTML page instead of dataset files. "
                    "This usually means public server download is blocked. "
                    "Provide Kaggle credentials or use a direct CSV/JSON source."
                ),
            )

        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            is_zip = "zip" in (content_type or "").lower() or content[:4] == b"PK\x03\x04"

            if is_zip:
                zip_path = tmpdir_path / "kaggle_dataset.zip"
                zip_path.write_bytes(content)

                try:
                    with zipfile.ZipFile(zip_path) as archive:
                        archive.extractall(tmpdir_path)
                except zipfile.BadZipFile:
                    raise HTTPException(
                        status_code=400,
                        detail="Kaggle download returned an invalid ZIP file.",
                    )

                selected = select_file(tmpdir_path, kaggle_file_path)
                rows, file_type = load_file_rows(selected, max_rows)
                return rows, selected.name, file_type

            # Non-zip fallback: try JSON first, otherwise CSV.
            if "json" in (content_type or "").lower() or content.strip().startswith((b"{", b"[")):
                file_path = tmpdir_path / "kaggle_dataset.json"
            else:
                file_path = tmpdir_path / "kaggle_dataset.csv"

            file_path.write_bytes(content)
            rows, file_type = load_file_rows(file_path, max_rows)
            return rows, file_path.name, file_type

    def public_download(slug: str):
        url = f"https://www.kaggle.com/api/v1/datasets/download/{slug}"

        request = Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 HEXAGUARD Dataset Importer",
                "Accept": "application/zip,text/csv,application/json,*/*",
            },
        )

        try:
            with urlopen(request, timeout=90) as response:
                content = response.read()
                content_type = response.headers.get("Content-Type", "")
                return read_downloaded_content(content, content_type, slug)
        except HTTPError as error:
            if error.code in {401, 403}:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "This Kaggle dataset could not be downloaded publicly by the server. "
                        "It may require Kaggle authentication, accepted dataset terms, or account access. "
                        "Provide Kaggle username/API key for this import only."
                    ),
                )

            if error.code == 404:
                raise HTTPException(
                    status_code=400,
                    detail="Kaggle dataset was not found. Use owner/dataset-slug or paste the Kaggle dataset page URL.",
                )

            raise HTTPException(
                status_code=400,
                detail=f"Kaggle public import failed with HTTP {error.code}.",
            )
        except URLError as error:
            raise HTTPException(
                status_code=400,
                detail=f"Kaggle public import failed: {error.reason}",
            )

    def authenticated_download(slug: str):
        try:
            from kaggle.api.kaggle_api_extended import KaggleApi
        except Exception as error:
            raise HTTPException(
                status_code=400,
                detail=f"Kaggle package is not available: {error}",
            )

        username = kaggle_username
        key = kaggle_key

        if kaggle_api_token:
            try:
                token_data = json.loads(kaggle_api_token)
                username = token_data.get("username", username)
                key = token_data.get("key", key)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid Kaggle API token JSON. Paste the content of kaggle.json.",
                )

        if not username or not key:
            raise HTTPException(
                status_code=400,
                detail="Provide both Kaggle username and API key, or paste kaggle_api_token.",
            )

        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)
            config_dir = tmpdir_path / ".kaggle"
            config_dir.mkdir(parents=True, exist_ok=True)

            token_file = config_dir / "kaggle.json"
            token_file.write_text(
                json.dumps({"username": username, "key": key}),
                encoding="utf-8",
            )
            token_file.chmod(0o600)

            old_config_dir = os.environ.get("KAGGLE_CONFIG_DIR")
            os.environ["KAGGLE_CONFIG_DIR"] = str(config_dir)

            try:
                api = KaggleApi()
                api.authenticate()
                api.dataset_download_files(
                    slug,
                    path=str(tmpdir_path),
                    unzip=True,
                    quiet=True,
                )
            except Exception as error:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Kaggle authenticated import failed. Check the dataset slug, "
                        "account access, accepted terms, and credentials. "
                        f"Details: {error}"
                    ),
                )
            finally:
                if old_config_dir is not None:
                    os.environ["KAGGLE_CONFIG_DIR"] = old_config_dir
                else:
                    os.environ.pop("KAGGLE_CONFIG_DIR", None)

            selected = select_file(tmpdir_path, kaggle_file_path)
            rows, file_type = load_file_rows(selected, max_rows)
            return rows, selected.name, file_type

    slug = normalize_slug(source_uri)

    has_credentials = bool(
        kaggle_api_token
        or (kaggle_username and kaggle_key)
    )

    if has_credentials:
        return authenticated_download(slug)

    return public_download(slug)



def _normalize_rows(
    dataset_id: str,
    rows: list[dict[str, Any]],
    mapping: dict[str, str | None],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    normalized_rows: list[dict[str, Any]] = []
    invalid_rows = 0
    detected_categories: set[str] = set()
    detected_severities: set[str] = set()
    mapped_owasp_count = 0

    for index, raw in enumerate(rows, start=1):
        prompt_value = _get_value(raw, mapping.get("prompt"))

        if prompt_value is None or not str(prompt_value).strip():
            invalid_rows += 1
            continue

        prompt = str(prompt_value).strip()

        row_id_value = _get_value(raw, mapping.get("row_id"))
        row_id = str(row_id_value).strip() if row_id_value else f"ROW-{index:05d}"

        attack_value = _get_value(raw, mapping.get("attack_category"))
        attack_category = (
            str(attack_value).strip() if attack_value else "User Dataset"
        )

        severity_value = _get_value(raw, mapping.get("severity"))
        risk_level_value = _get_value(raw, mapping.get("risk_level"))
        subcategory_value = _get_value(raw, mapping.get("subcategory"))
        owasp_value = _get_value(raw, mapping.get("owasp_category"))

        risk_fields = normalize_dataset_risk_fields(
            prompt=prompt,
            attack_category=attack_category,
            risk_level=str(risk_level_value).strip() if risk_level_value else None,
            severity=str(severity_value).strip() if severity_value else None,
            subcategory=str(subcategory_value).strip() if subcategory_value else None,
            owasp_category=str(owasp_value).strip() if owasp_value else None,
        )

        expected_value = _get_value(raw, mapping.get("expected_safe_behavior"))
        language_value = _get_value(raw, mapping.get("language"))
        tags_value = _get_value(raw, mapping.get("tags"))

        used_columns = {
            value
            for value in mapping.values()
            if value is not None and str(value).strip()
        }

        metadata = {
            key: value
            for key, value in raw.items()
            if key not in used_columns
        }

        item = {
            "dataset_id": dataset_id,
            "row_id": row_id,
            "prompt": prompt,
            "attack_category": risk_fields["attack_category"],
            "severity": risk_fields["severity"],
            "risk_level": risk_fields["risk_level"],
            "subcategory": risk_fields["subcategory"],
            "owasp_category": risk_fields["owasp_category"],
            "expected_safe_behavior": str(expected_value).strip()
            if expected_value
            else None,
            "language": str(language_value).strip() if language_value else None,
            "tags": _split_tags(tags_value),
            "row_metadata": metadata,
        }

        if item["attack_category"]:
            detected_categories.add(str(item["attack_category"]))

        if item["severity"]:
            detected_severities.add(str(item["severity"]))

        if item["owasp_category"]:
            mapped_owasp_count += 1

        normalized_rows.append(item)

    total_rows = len(rows)
    valid_rows = len(normalized_rows)

    compatibility_report = {
        "total_rows_detected": total_rows,
        "valid_rows": valid_rows,
        "invalid_rows": invalid_rows,
        "original_columns": list(rows[0].keys()) if rows else [],
        "detected_mapping": mapping,
        "missing_prompt_rows": invalid_rows,
        "detected_categories": sorted(detected_categories),
        "detected_severities": sorted(detected_severities),
        "owasp_mapping_coverage_percent": round(
            (mapped_owasp_count / valid_rows) * 100, 2
        )
        if valid_rows
        else 0.0,
        "ready_for_campaign": valid_rows > 0,
        "messages": [
            "Dataset is compatible with prompt-based campaign testing."
            if valid_rows > 0
            else "Dataset is not ready because no valid prompt rows were found."
        ],
    }

    return normalized_rows, compatibility_report


class DatasetConnectorService:
    @staticmethod
    async def import_connector_dataset(
        db: AsyncSession,
        payload: DatasetImportRequest,
    ):
        source_type = str(payload.source_type)
        max_rows = max(1, min(int(payload.max_rows or 100), 500))

        if source_type == "huggingface":
            rows, filename = await _fetch_huggingface_rows(
                source_uri=payload.source_uri,
                max_rows=max_rows,
                hf_token=getattr(payload, "hf_token", None),
            )
            file_type = "csv"

        elif source_type == "kaggle":
            rows, filename, file_type = _fetch_kaggle_rows(
                source_uri=payload.source_uri,
                max_rows=max_rows,
                kaggle_username=getattr(payload, "kaggle_username", None),
                kaggle_key=getattr(payload, "kaggle_key", None),
                kaggle_api_token=getattr(payload, "kaggle_api_token", None),
                kaggle_file_path=getattr(payload, "kaggle_file_path", None),
            )

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported connector source_type: {source_type}",
            )

        if not rows:
            raise HTTPException(
                status_code=400,
                detail="Connector returned no readable rows.",
            )

        dataset_id = _new_dataset_id()
        mapping_result = get_best_dataset_mapping(rows, payload.column_mapping)
        mapping = mapping_result["mapping"]

        normalized_rows, compatibility_report = _normalize_rows(
            dataset_id=dataset_id,
            rows=rows,
            mapping=mapping,
        )

        compatibility_report["auto_mapping"] = mapping_result
        compatibility_report["mapping_confidence"] = mapping_result.get("overall_confidence")
        compatibility_report["mapping_decision"] = mapping_result.get("mapping_decision")

        dataset = UploadedDataset(
            dataset_id=dataset_id,
            name=payload.name or f"{source_type} imported dataset",
            filename=filename,
            file_type=file_type,
            source_type=source_type,
            source_uri=payload.source_uri,
            row_count=len(normalized_rows),
            validation_status="validated"
            if compatibility_report["ready_for_campaign"]
            else "invalid",
            validation_message="Dataset validated successfully."
            if compatibility_report["ready_for_campaign"]
            else "Dataset validation failed.",
            original_columns=compatibility_report["original_columns"],
            detected_mapping=mapping,
            validation_report=compatibility_report,
        )

        db.add(dataset)
        await db.commit()
        await db.refresh(dataset)

        normalized_rows = sanitize_dataset_rows_for_db(normalized_rows)

        db_rows = [
            DatasetRow(
                dataset_pk=dataset.id,
                dataset_id=dataset.dataset_id,
                row_id=row["row_id"],
                prompt=row["prompt"],
                attack_category=row["attack_category"],
                severity=row["severity"],
                risk_level=row["risk_level"],
                subcategory=row["subcategory"],
                owasp_category=row["owasp_category"],
                expected_safe_behavior=row["expected_safe_behavior"],
                language=row["language"],
                tags=row["tags"],
                row_metadata=row["row_metadata"],
            )
            for row in normalized_rows
        ]

        db.add_all(db_rows)
        await db.commit()

        result = await db.execute(
            select(DatasetRow)
            .where(DatasetRow.dataset_pk == dataset.id)
            .order_by(DatasetRow.id.asc())
            .limit(10)
        )

        preview_rows = list(result.scalars().all())

        return {
            "dataset": dataset,
            "preview_rows": preview_rows,
            "compatibility_report": compatibility_report,
        }

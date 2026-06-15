import csv
import io
import ipaddress
import json
import socket
import uuid
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, UploadFile
from app.services.security_modules.dataset_row_sanitizer import sanitize_dataset_rows_for_db
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import DatasetRow, UploadedDataset
from app.schemas.dataset import DatasetColumnMapping, DatasetImportRequest
from app.services.dataset_auto_mapper_svc import get_best_dataset_mapping
from app.services.security_modules.input_risk_detector import normalize_dataset_risk_fields


PROMPT_CANDIDATES = [
    "prompt",
    "instruction",
    "input",
    "question",
    "query",
    "text",
    "user_prompt",
    "attack_prompt",
    "message",
    "request",
]

ROW_ID_CANDIDATES = ["row_id", "test_id", "id", "case_id", "sample_id"]
CATEGORY_CANDIDATES = ["attack_category", "category", "attack_type", "type", "risk_category"]
SEVERITY_CANDIDATES = ["severity", "risk_level", "risk", "priority"]
RISK_LEVEL_CANDIDATES = ["risk_level", "risk", "severity", "priority"]
SUBCATEGORY_CANDIDATES = ["subcategory", "sub_category", "harm_type", "risk_subcategory"]
OWASP_CANDIDATES = ["owasp_category", "owasp", "owasp_mapping", "owasp_id"]
EXPECTED_CANDIDATES = ["expected_safe_behavior", "expected_behavior", "expected", "safe_behavior"]
LANGUAGE_CANDIDATES = ["language", "lang"]
TAGS_CANDIDATES = ["tags", "labels"]


def _normalize_column_name(name: str) -> str:
    return name.strip().lower().replace("-", "_").replace(" ", "_")


def _find_column(columns: list[str], candidates: list[str]) -> str | None:
    normalized_lookup = {_normalize_column_name(column): column for column in columns}

    for candidate in candidates:
        normalized_candidate = _normalize_column_name(candidate)

        if normalized_candidate in normalized_lookup:
            return normalized_lookup[normalized_candidate]

    return None


def _mapping_to_dict(mapping: DatasetColumnMapping | None) -> dict[str, str | None]:
    if not mapping:
        return {}

    return mapping.model_dump(exclude_none=True)


def _auto_detect_mapping(
    columns: list[str],
    user_mapping: DatasetColumnMapping | None = None,
) -> dict[str, str | None]:
    detected = {
        "prompt": _find_column(columns, PROMPT_CANDIDATES),
        "row_id": _find_column(columns, ROW_ID_CANDIDATES),
        "attack_category": _find_column(columns, CATEGORY_CANDIDATES),
        "severity": _find_column(columns, SEVERITY_CANDIDATES),
        "risk_level": _find_column(columns, RISK_LEVEL_CANDIDATES),
        "subcategory": _find_column(columns, SUBCATEGORY_CANDIDATES),
        "owasp_category": _find_column(columns, OWASP_CANDIDATES),
        "expected_safe_behavior": _find_column(columns, EXPECTED_CANDIDATES),
        "language": _find_column(columns, LANGUAGE_CANDIDATES),
        "tags": _find_column(columns, TAGS_CANDIDATES),
    }

    for internal_field, selected_column in _mapping_to_dict(user_mapping).items():
        if selected_column:
            if selected_column not in columns:
                raise ValueError(
                    f"Mapped column '{selected_column}' for '{internal_field}' does not exist."
                )

            detected[internal_field] = selected_column

    return detected


def _normalize_tags(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]

    return [str(value)]


def _get_value(raw: dict[str, Any], column: str | None) -> Any:
    if not column:
        return None

    return raw.get(column)


def _normalize_row(
    raw: dict[str, Any],
    index: int,
    mapping: dict[str, str | None],
    original_columns: list[str],
) -> dict[str, Any] | None:
    prompt_value = _get_value(raw, mapping.get("prompt"))
    prompt = str(prompt_value or "").strip()

    if not prompt:
        return None

    row_id_value = _get_value(raw, mapping.get("row_id"))
    row_id = str(row_id_value or f"ROW-{index:04d}").strip()

    category_value = _get_value(raw, mapping.get("attack_category"))
    attack_category = str(category_value or "User Dataset").strip()

    severity_value = _get_value(raw, mapping.get("severity"))
    risk_level_value = _get_value(raw, mapping.get("risk_level"))
    subcategory_value = _get_value(raw, mapping.get("subcategory"))

    raw_severity = str(severity_value).strip() if severity_value is not None else None
    raw_risk_level = str(risk_level_value).strip() if risk_level_value is not None else None
    raw_subcategory = str(subcategory_value).strip() if subcategory_value is not None else None

    owasp_value = _get_value(raw, mapping.get("owasp_category"))
    raw_owasp_category = str(owasp_value).strip() if owasp_value is not None else None
    raw_owasp_category = raw_owasp_category or None

    risk_fields = normalize_dataset_risk_fields(
        prompt=prompt,
        attack_category=attack_category,
        risk_level=raw_risk_level,
        severity=raw_severity,
        subcategory=raw_subcategory,
        owasp_category=raw_owasp_category,
    )

    severity = risk_fields["severity"]
    risk_level = risk_fields["risk_level"]
    subcategory = risk_fields["subcategory"]
    owasp_category = risk_fields["owasp_category"]

    expected_value = _get_value(raw, mapping.get("expected_safe_behavior"))
    expected_safe_behavior = (
        str(expected_value).strip() if expected_value is not None else None
    )
    expected_safe_behavior = expected_safe_behavior or None

    language_value = _get_value(raw, mapping.get("language"))
    language = str(language_value).strip() if language_value is not None else None
    language = language or None

    tags_value = _get_value(raw, mapping.get("tags"))

    mapped_columns = {column for column in mapping.values() if column}

    metadata = {
        key: value
        for key, value in raw.items()
        if key in original_columns and key not in mapped_columns
    }

    return {
        "row_id": row_id,
        "prompt": prompt,
        "attack_category": attack_category,
        "severity": severity,
        "risk_level": risk_level,
        "subcategory": subcategory,
        "owasp_category": owasp_category,
        "expected_safe_behavior": expected_safe_behavior,
        "language": language,
        "tags": _normalize_tags(tags_value),
        "row_metadata": metadata,
    }


def _parse_csv(content: str) -> tuple[list[dict[str, Any]], list[str]]:
    stream = io.StringIO(content)
    reader = csv.DictReader(stream)

    if not reader.fieldnames:
        raise ValueError("CSV file has no header row.")

    rows = list(reader)
    columns = list(reader.fieldnames)

    return rows, columns


def _parse_json(content: str) -> tuple[list[dict[str, Any]], list[str]]:
    parsed = json.loads(content)

    if isinstance(parsed, dict):
        raw_rows = parsed.get("rows")

        if raw_rows is None:
            raise ValueError("JSON object must contain a 'rows' array.")
    elif isinstance(parsed, list):
        raw_rows = parsed
    else:
        raise ValueError("JSON must be either an array or an object with rows array.")

    if not isinstance(raw_rows, list):
        raise ValueError("'rows' must be a list.")

    rows = []

    for index, row in enumerate(raw_rows, start=1):
        if not isinstance(row, dict):
            raise ValueError(f"Row {index} must be an object.")

        rows.append(row)

    columns = sorted({key for row in rows for key in row.keys()})

    return rows, columns


def _parse_content_by_filename(content: str, filename: str):
    if filename.lower().endswith(".csv"):
        return _parse_csv(content), "csv"

    if filename.lower().endswith(".json"):
        return _parse_json(content), "json"

    raise ValueError("Only CSV and JSON dataset files are supported.")


def _build_report(
    raw_rows: list[dict[str, Any]],
    normalized_rows: list[dict[str, Any]],
    original_columns: list[str],
    mapping: dict[str, str | None],
) -> dict[str, Any]:
    total_rows = len(raw_rows)
    valid_rows = len(normalized_rows)
    invalid_rows = total_rows - valid_rows

    categories = sorted(
        {
            row.get("attack_category", "User Dataset")
            for row in normalized_rows
            if row.get("attack_category")
        }
    )

    severities = sorted(
        {
            row.get("severity", "Medium")
            for row in normalized_rows
            if row.get("severity")
        }
    )

    owasp_count = sum(1 for row in normalized_rows if row.get("owasp_category"))

    owasp_coverage = round((owasp_count / valid_rows) * 100, 2) if valid_rows else 0.0

    messages = []

    if not mapping.get("prompt"):
        messages.append("No prompt-like column was detected or mapped.")

    if invalid_rows:
        messages.append(f"{invalid_rows} row(s) were skipped because prompt was missing.")

    if valid_rows:
        messages.append("Dataset is compatible with prompt-based campaign testing.")

    ready = bool(valid_rows and mapping.get("prompt"))

    return {
        "total_rows_detected": total_rows,
        "valid_rows": valid_rows,
        "invalid_rows": invalid_rows,
        "original_columns": original_columns,
        "detected_mapping": mapping,
        "missing_prompt_rows": invalid_rows,
        "detected_categories": categories,
        "detected_severities": severities,
        "owasp_mapping_coverage_percent": owasp_coverage,
        "ready_for_campaign": ready,
        "messages": messages,
    }


def _is_private_or_blocked_host(hostname: str) -> bool:
    blocked_hosts = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}

    if hostname.lower() in blocked_hosts:
        return True

    try:
        ip = ipaddress.ip_address(hostname)

        return (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
        )
    except ValueError:
        pass

    try:
        addresses = socket.getaddrinfo(hostname, None)

        for address in addresses:
            ip = ipaddress.ip_address(address[4][0])

            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_multicast
                or ip.is_reserved
            ):
                return True
    except socket.gaierror:
        return True

    return False


def _validate_public_url(url: str):
    parsed = urlparse(url)

    if parsed.scheme not in {"https", "http"}:
        raise ValueError("Only http and https URLs are allowed.")

    if not parsed.hostname:
        raise ValueError("URL hostname is missing.")

    if _is_private_or_blocked_host(parsed.hostname):
        raise ValueError("Private, local, or internal URLs are not allowed.")

    if not parsed.path.lower().endswith((".csv", ".json")):
        raise ValueError("URL must point to a CSV or JSON file.")


def _validate_github_raw_url(url: str):
    _validate_public_url(url)

    parsed = urlparse(url)
    host = parsed.hostname or ""

    allowed_hosts = {"raw.githubusercontent.com", "gist.githubusercontent.com"}

    if host.lower() not in allowed_hosts:
        raise ValueError(
            "GitHub import currently supports raw.githubusercontent.com or gist.githubusercontent.com URLs only."
        )


async def _fetch_url_content(url: str) -> tuple[str, str]:
    async with httpx.AsyncClient(
        timeout=60.0,
        follow_redirects=True,
        limits=httpx.Limits(max_connections=5, max_keepalive_connections=2),
    ) as client:
        response = await client.get(url)
        response.raise_for_status()

        content_type = response.headers.get("content-type", "")
        raw_bytes = response.content

        if len(raw_bytes) > 2_000_000:
            raise ValueError("Remote dataset file is too large. Maximum size is 2MB.")

        if (
            "text" not in content_type
            and "json" not in content_type
            and "csv" not in content_type
            and content_type
        ):
            raise ValueError(f"Unsupported remote content type: {content_type}")

        try:
            content = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raise ValueError("Remote dataset must be UTF-8 encoded.")

    filename = urlparse(url).path.split("/")[-1] or "remote_dataset.csv"

    return content, filename


class DatasetService:
    @staticmethod
    async def _create_dataset_from_content(
        db: AsyncSession,
        content: str,
        filename: str,
        name: str | None,
        source_type: str,
        source_uri: str | None,
        column_mapping: DatasetColumnMapping | None = None,
        max_rows: int = 500,
    ):
        try:
            (raw_rows, original_columns), file_type = _parse_content_by_filename(
                content,
                filename,
            )

            raw_rows = raw_rows[:max_rows]

            mapping = _auto_detect_mapping(original_columns, column_mapping)

            if not mapping.get("prompt"):
                raise ValueError(
                    "No prompt-like column found. Please map a column to prompt."
                )

            normalized_rows = []

            for index, raw_row in enumerate(raw_rows, start=1):
                normalized = _normalize_row(
                    raw=raw_row,
                    index=index,
                    mapping=mapping,
                    original_columns=original_columns,
                )

                if normalized:
                    normalized_rows.append(normalized)

            report = _build_report(
                raw_rows=raw_rows,
                normalized_rows=normalized_rows,
                original_columns=original_columns,
                mapping=mapping,
            )

        except Exception as error:
            raise HTTPException(
                status_code=400,
                detail=f"Dataset validation failed: {error}",
            )

        if not normalized_rows:
            raise HTTPException(
                status_code=400,
                detail="Dataset must contain at least one valid prompt row.",
            )

        dataset = UploadedDataset(
            dataset_id=f"HXG-DS-{uuid.uuid4().hex[:8].upper()}",
            name=name or filename,
            filename=filename,
            file_type=file_type,
            source_type=source_type,
            source_uri=source_uri,
            row_count=len(normalized_rows),
            validation_status="validated" if report["ready_for_campaign"] else "needs_mapping",
            validation_message="Dataset validated successfully.",
            original_columns=original_columns,
            detected_mapping=mapping,
            validation_report=report,
        )

        db.add(dataset)
        await db.commit()
        await db.refresh(dataset)

        for row in normalized_rows:
            db.add(
                DatasetRow(
                    dataset_pk=dataset.id,
                    dataset_id=dataset.dataset_id,
                    **row,
                )
            )

        await db.commit()

        preview_result = await db.execute(
            select(DatasetRow)
            .where(DatasetRow.dataset_pk == dataset.id)
            .order_by(DatasetRow.id.asc())
            .limit(10)
        )

        return {
            "dataset": dataset,
            "preview_rows": list(preview_result.scalars().all()),
            "compatibility_report": report,
        }

    @staticmethod
    async def upload_dataset(
        db: AsyncSession,
        file: UploadFile,
        name: str | None = None,
    ):
        filename = file.filename or "uploaded_dataset.csv"

        if not filename.lower().endswith((".csv", ".json")):
            raise HTTPException(
                status_code=400,
                detail="Only CSV and JSON dataset files are supported.",
            )

        raw_bytes = await file.read()

        if len(raw_bytes) > 2_000_000:
            raise HTTPException(
                status_code=400,
                detail="Dataset file is too large. Maximum size is 2MB.",
            )

        try:
            content = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Dataset file must be UTF-8 encoded.",
            )

        result = await DatasetService._create_dataset_from_content(
            db=db,
            content=content,
            filename=filename,
            name=name,
            source_type="local_upload",
            source_uri=None,
            column_mapping=None,
            max_rows=500,
        )

        return {
            "dataset": result["dataset"],
            "preview_rows": result["preview_rows"],
        }

    @staticmethod
    async def import_dataset(
        db: AsyncSession,
        payload: DatasetImportRequest,
    ):
        try:
            if payload.source_type == "direct_url":
                _validate_public_url(payload.source_uri)

            if payload.source_type == "github_raw":
                _validate_github_raw_url(payload.source_uri)

            content, filename = await _fetch_url_content(payload.source_uri)

        except httpx.HTTPStatusError as error:
            raise HTTPException(
                status_code=400,
                detail=f"Remote dataset fetch failed with status {error.response.status_code}.",
            )
        except Exception as error:
            raise HTTPException(
                status_code=400,
                detail=f"Remote dataset import failed: {error}",
            )

        return await DatasetService._create_dataset_from_content(
            db=db,
            content=content,
            filename=filename,
            name=payload.name,
            source_type=payload.source_type,
            source_uri=payload.source_uri,
            column_mapping=payload.column_mapping,
            max_rows=payload.max_rows,
        )

    @staticmethod
    async def list_datasets(db: AsyncSession):
        total_result = await db.execute(select(func.count(UploadedDataset.id)))
        total = total_result.scalar_one()

        result = await db.execute(
            select(UploadedDataset).order_by(UploadedDataset.created_at.desc())
        )

        return {
            "total": total,
            "items": list(result.scalars().all()),
        }

    @staticmethod
    async def get_dataset(db: AsyncSession, dataset_id: str):
        result = await db.execute(
            select(UploadedDataset).where(UploadedDataset.dataset_id == dataset_id)
        )

        dataset = result.scalars().first()

        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found.")

        return dataset

    @staticmethod
    async def get_dataset_rows(db: AsyncSession, dataset_id: str):
        dataset = await DatasetService.get_dataset(db, dataset_id)

        result = await db.execute(
            select(DatasetRow)
            .where(DatasetRow.dataset_pk == dataset.id)
            .order_by(DatasetRow.id.asc())
        )

        items = list(result.scalars().all())

        return {
            "dataset_id": dataset.dataset_id,
            "total": len(items),
            "items": items,
        }

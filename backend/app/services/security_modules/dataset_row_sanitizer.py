import re
from typing import Any


def _safe_string(value: Any) -> str:
    if value is None:
        return ""

    return str(value).strip()


def _short_text(value: Any, max_length: int, fallback: str | None = None) -> str | None:
    text = _safe_string(value)

    if not text:
        return fallback

    if len(text) <= max_length:
        return text

    return text[:max_length].rstrip()


def _safe_row_id(value: Any, index: int, prompt: str | None = None) -> str:
    text = _safe_string(value)
    prompt_text = _safe_string(prompt)

    # Never use the full prompt as the database row_id.
    if not text or text == prompt_text or len(text) > 100:
        return f"ROW-{index:05d}"

    cleaned = re.sub(r"[^A-Za-z0-9_.:-]+", "-", text).strip("-")

    if not cleaned or len(cleaned) > 100:
        return f"ROW-{index:05d}"

    return cleaned


def sanitize_dataset_rows_for_db(rows: list[dict]) -> list[dict]:
    sanitized_rows: list[dict] = []

    for index, row in enumerate(rows, start=1):
        safe_row = dict(row)
        prompt = _safe_string(safe_row.get("prompt"))

        safe_row["row_id"] = _safe_row_id(
            safe_row.get("row_id"),
            index,
            prompt=prompt,
        )

        safe_row["attack_category"] = (
            _short_text(safe_row.get("attack_category"), 255, "User Dataset")
            or "User Dataset"
        )

        safe_row["severity"] = (
            _short_text(safe_row.get("severity"), 50, "Medium")
            or "Medium"
        )

        safe_row["risk_level"] = (
            _short_text(safe_row.get("risk_level"), 50, safe_row["severity"])
            or safe_row["severity"]
        )

        safe_row["subcategory"] = _short_text(
            safe_row.get("subcategory"),
            100,
            None,
        )

        safe_row["owasp_category"] = _short_text(
            safe_row.get("owasp_category"),
            255,
            None,
        )

        safe_row["language"] = _short_text(
            safe_row.get("language"),
            50,
            None,
        )

        if not isinstance(safe_row.get("tags"), list):
            safe_row["tags"] = []

        if not isinstance(safe_row.get("row_metadata"), dict):
            safe_row["row_metadata"] = {}

        sanitized_rows.append(safe_row)

    return sanitized_rows

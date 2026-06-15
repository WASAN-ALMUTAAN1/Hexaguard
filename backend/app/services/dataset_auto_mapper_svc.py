
def _finalize_safe_mapping(mapping: dict) -> dict:
    finalized = dict(mapping or {})

    for key, value in list(finalized.items()):
        if value == "":
            finalized[key] = None

    if finalized.get("row_id") and finalized.get("row_id") == finalized.get("prompt"):
        finalized["row_id"] = None

    return finalized

import json
import os
from typing import Any


HEXAGUARD_FIELDS = [
    "prompt",
    "row_id",
    "attack_category",
    "severity",
    "risk_level",
    "subcategory",
    "owasp_category",
    "expected_safe_behavior",
    "language",
    "tags",
]


COLUMN_CANDIDATES = {
    "prompt": [
        "prompt",
        "instruction",
        "input",
        "question",
        "query",
        "text",
        "content",
        "message",
        "user_message",
        "contestant_message",
        "submission_message",
        "conversation",
        "red_team_prompt",
        "jailbreak_prompt",
        "attack_prompt",
        "user_prompt",
    ],
    "row_id": [
        "id",
        "row_id",
        "prompt_id",
        "case_id",
        "test_id",
        "example_id",
        "sample_id",
    ],
    "attack_category": [
        "attack_category",
        "category",
        "category_name",
        "attack_type",
        "type",
        "label",
        "risk_category",
        "class",
    ],
    "severity": [
        "severity",
        "risk_level",
        "risk",
        "priority",
        "impact",
        "criticality",
    ],
    "risk_level": [
        "risk_level",
        "risk",
        "severity",
        "priority",
        "impact",
        "criticality",
    ],
    "subcategory": [
        "subcategory",
        "sub_category",
        "challenges_name",
        "challenge_name",
        "harm_type",
        "risk_subcategory",
        "topic",
    ],
    "owasp_category": [
        "owasp_category",
        "owasp",
        "owasp_mapping",
        "llm_top_10",
        "cwe",
    ],
    "expected_safe_behavior": [
        "expected_safe_behavior",
        "expected",
        "expected_behavior",
        "safe_behavior",
        "description",
        "challenges_name",
        "policy",
        "ideal_response",
    ],
    "language": [
        "language",
        "lang",
        "locale",
    ],
    "tags": [
        "tags",
        "tag",
        "keywords",
    ],
}


def _normalize_name(value: str) -> str:
    return value.strip().lower().replace("-", "_").replace(" ", "_")


def _is_usable_column_name(column: str) -> bool:
    normalized = _normalize_name(column)
    return bool(normalized) and normalized not in {"unnamed:_0", "unnamed_0", "index"}


def _clean_mapping_value(value: Any) -> str | None:
    if value is None:
        return None

    text = str(value).strip()
    return text or None


def _mapping_to_dict(mapping: Any) -> dict[str, str | None]:
    if mapping is None:
        return {}

    if hasattr(mapping, "model_dump"):
        data = mapping.model_dump()
    elif isinstance(mapping, dict):
        data = mapping
    else:
        data = {}

    return {
        field: _clean_mapping_value(data.get(field))
        for field in HEXAGUARD_FIELDS
    }


def _safe_sample(value: Any, max_chars: int = 160) -> str:
    if value is None:
        return ""

    text = str(value).replace("\n", " ").strip()

    if len(text) > max_chars:
        return text[:max_chars] + "..."

    return text


def profile_dataset_columns(rows: list[dict[str, Any]], sample_size: int = 20) -> dict[str, Any]:
    if not rows:
        return {
            "columns": [],
            "column_profiles": {},
        }

    sample_rows = rows[:sample_size]
    columns: list[str] = []

    for row in sample_rows:
        for column in row.keys():
            if column not in columns:
                columns.append(column)

    profiles: dict[str, dict[str, Any]] = {}

    for column in columns:
        values = [row.get(column) for row in sample_rows]
        non_empty_values = [
            value for value in values
            if value is not None and str(value).strip() != ""
        ]

        text_values = [str(value) for value in non_empty_values]
        lengths = [len(value) for value in text_values]

        unique_values = set(text_values)

        avg_length = round(sum(lengths) / len(lengths), 2) if lengths else 0
        empty_ratio = round(1 - (len(non_empty_values) / max(len(values), 1)), 2)
        unique_ratio = round(len(unique_values) / max(len(non_empty_values), 1), 2)

        profiles[column] = {
            "sample_values": [_safe_sample(value) for value in non_empty_values[:5]],
            "non_empty_count": len(non_empty_values),
            "empty_ratio": empty_ratio,
            "unique_count": len(unique_values),
            "unique_ratio": unique_ratio,
            "average_text_length": avg_length,
            "looks_like_long_text": avg_length >= 35,
            "looks_like_category": unique_ratio <= 0.35 and len(unique_values) <= 25,
            "looks_like_id": unique_ratio >= 0.9 and avg_length <= 80,
        }

    return {
        "columns": columns,
        "column_profiles": profiles,
    }


def _name_score(column: str, field: str) -> tuple[float, list[str]]:
    normalized_column = _normalize_name(column)
    reasons: list[str] = []

    best_score = 0.0

    for candidate in COLUMN_CANDIDATES.get(field, []):
        normalized_candidate = _normalize_name(candidate)

        if normalized_column == normalized_candidate:
            best_score = max(best_score, 0.95)
            reasons.append(f"column name exactly matches candidate '{candidate}'")

        elif normalized_candidate in normalized_column:
            best_score = max(best_score, 0.78)
            reasons.append(f"column name contains candidate '{candidate}'")

        elif normalized_column in normalized_candidate:
            best_score = max(best_score, 0.55)
            reasons.append(f"column name partially matches candidate '{candidate}'")

    return best_score, reasons


def _profile_score(
    column: str,
    field: str,
    profile: dict[str, Any],
) -> tuple[float, list[str]]:
    reasons: list[str] = []
    score = 0.0

    avg_length = float(profile.get("average_text_length", 0))
    unique_ratio = float(profile.get("unique_ratio", 0))
    empty_ratio = float(profile.get("empty_ratio", 0))
    samples = " ".join(profile.get("sample_values", [])).lower()

    if field == "prompt":
        if avg_length >= 40:
            score += 0.30
            reasons.append("values look like long prompt text")

        if unique_ratio >= 0.7:
            score += 0.15
            reasons.append("values are mostly unique, which fits prompt data")

        if any(word in samples for word in ["ignore", "system", "instruction", "write", "generate", "explain", "user"]):
            score += 0.15
            reasons.append("sample values contain prompt-like words")

        if empty_ratio > 0.5:
            score -= 0.35
            reasons.append("many values are empty")

    elif field in {"attack_category", "severity", "risk_level", "subcategory", "language", "tags"}:
        if profile.get("looks_like_category"):
            score += 0.30
            reasons.append("values look categorical")

        if avg_length <= 60:
            score += 0.10
            reasons.append("values are short labels")

    elif field == "row_id":
        if profile.get("looks_like_id"):
            score += 0.30
            reasons.append("values look like identifiers")

    elif field == "expected_safe_behavior":
        if avg_length >= 20:
            score += 0.15
            reasons.append("values contain descriptive text")

    elif field == "owasp_category":
        if "llm" in samples or "owasp" in samples:
            score += 0.35
            reasons.append("sample values mention LLM/OWASP")

    return max(score, 0.0), reasons


def deterministic_auto_map(
    rows: list[dict[str, Any]],
    requested_mapping: Any = None,
) -> dict[str, Any]:
    profile_report = profile_dataset_columns(rows)
    columns = profile_report["columns"]
    column_profiles = profile_report["column_profiles"]

    requested = _mapping_to_dict(requested_mapping)

    mapping: dict[str, str | None] = {}
    field_confidence: dict[str, float] = {}
    field_reasons: dict[str, list[str]] = {}
    candidates: dict[str, list[dict[str, Any]]] = {}

    for field in HEXAGUARD_FIELDS:
        if requested.get(field):
            mapping[field] = requested[field]
            field_confidence[field] = 1.0
            field_reasons[field] = ["user-provided mapping"]
            candidates[field] = [
                {
                    "column": requested[field],
                    "score": 1.0,
                    "reasons": ["user-provided mapping"],
                }
            ]
            continue

        scored_candidates: list[dict[str, Any]] = []

        for column in columns:
            if not _is_usable_column_name(column):
                continue

            profile = column_profiles.get(column, {})
            name_score, name_reasons = _name_score(column, field)
            profile_score, profile_reasons = _profile_score(column, field, profile)

            total_score = round(min(name_score + profile_score, 1.0), 3)

            if total_score > 0:
                scored_candidates.append(
                    {
                        "column": column,
                        "score": total_score,
                        "reasons": name_reasons + profile_reasons,
                    }
                )

        scored_candidates.sort(key=lambda item: item["score"], reverse=True)
        candidates[field] = scored_candidates[:5]

        if scored_candidates:
            best = scored_candidates[0]
            mapping[field] = best["column"] if best["score"] >= 0.55 else None
            field_confidence[field] = best["score"]
            field_reasons[field] = best["reasons"]
        else:
            mapping[field] = None
            field_confidence[field] = 0.0
            field_reasons[field] = ["no suitable column detected"]

    prompt_confidence = field_confidence.get("prompt", 0.0)

    if prompt_confidence >= 0.82:
        overall_confidence = "High"
        mapping_decision = "auto_applied"
    elif prompt_confidence >= 0.55:
        overall_confidence = "Medium"
        mapping_decision = "suggested_review"
    else:
        overall_confidence = "Low"
        mapping_decision = "manual_mapping_required"

    return {
        "mapping": mapping,
        "profile_report": profile_report,
        "field_confidence": field_confidence,
        "field_reasons": field_reasons,
        "candidates": candidates,
        "overall_confidence": overall_confidence,
        "mapping_decision": mapping_decision,
        "used_llm_mapper": False,
        "llm_reason": None,
    }


def _safe_json_from_text(text: str) -> dict[str, Any] | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")

        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                return None

    return None


def _build_llm_mapper_payload(auto_result: dict[str, Any]) -> dict[str, Any]:
    profile_report = auto_result.get("profile_report", {})
    column_profiles = profile_report.get("column_profiles", {})

    compact_profiles = {}

    for column, profile in column_profiles.items():
        compact_profiles[column] = {
            "sample_values": profile.get("sample_values", [])[:3],
            "average_text_length": profile.get("average_text_length"),
            "empty_ratio": profile.get("empty_ratio"),
            "unique_ratio": profile.get("unique_ratio"),
            "looks_like_long_text": profile.get("looks_like_long_text"),
            "looks_like_category": profile.get("looks_like_category"),
        }

    return {
        "target_fields": HEXAGUARD_FIELDS,
        "columns": profile_report.get("columns", []),
        "column_profiles": compact_profiles,
        "deterministic_mapping": auto_result.get("mapping", {}),
        "deterministic_confidence": auto_result.get("field_confidence", {}),
    }


def optional_llm_auto_map(auto_result: dict[str, Any]) -> dict[str, Any] | None:
    provider = os.getenv("DATASET_AUTO_MAPPER_PROVIDER", "").lower().strip()
    model = os.getenv("DATASET_AUTO_MAPPER_MODEL", "").strip()

    if provider not in {"groq", "openai"}:
        return None

    payload = _build_llm_mapper_payload(auto_result)

    system_prompt = """
You are HEXAGUARD Dataset Mapping Assistant.
Map dataset columns to HEXAGUARD fields for LLM safety/red-team campaigns.
Use only provided column names and safe samples.
Do not infer secrets.
Return JSON only:
{
  "mapping": {
    "prompt": "...",
    "row_id": null,
    "attack_category": "...",
    "severity": null,
    "risk_level": null,
    "subcategory": "...",
    "owasp_category": null,
    "expected_safe_behavior": "..."
  },
  "confidence": "High|Medium|Low",
  "reason": "short explanation"
}
The prompt field must map to the column most likely containing the user/test prompt.
"""

    try:
        if provider == "groq":
            from groq import Groq

            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                return None

            client = Groq(api_key=api_key)
            response = client.chat.completions.create(
                model=model or "llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content or "{}"
            return _safe_json_from_text(content)

        if provider == "openai":
            from openai import OpenAI

            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                return None

            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=model or "gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content or "{}"
            return _safe_json_from_text(content)

    except Exception as error:
        print("DATASET AUTO MAPPER LLM ERROR:", repr(error))
        return None

    return None


def validate_llm_mapping(
    llm_result: dict[str, Any],
    columns: list[str],
) -> dict[str, str | None]:
    raw_mapping = llm_result.get("mapping", {})
    valid_mapping: dict[str, str | None] = {}

    normalized_columns = {
        _normalize_name(column): column
        for column in columns
    }

    for field in HEXAGUARD_FIELDS:
        value = raw_mapping.get(field)

        if value is None:
            valid_mapping[field] = None
            continue

        value_text = str(value).strip()

        if not value_text:
            valid_mapping[field] = None
            continue

        normalized_value = _normalize_name(value_text)

        if normalized_value in normalized_columns:
            valid_mapping[field] = normalized_columns[normalized_value]
        elif value_text in columns:
            valid_mapping[field] = value_text
        else:
            valid_mapping[field] = None

    return valid_mapping


def _finalize_mapping(mapping: dict[str, str | None]) -> dict[str, str | None]:
    return {
        key: value if value and str(value).strip() else None
        for key, value in mapping.items()
    }


def get_best_dataset_mapping(
    rows: list[dict[str, Any]],
    requested_mapping: Any = None,
) -> dict[str, Any]:
    auto_result = deterministic_auto_map(rows, requested_mapping)

    # If user provided prompt mapping or deterministic confidence is high, do not call LLM.
    requested = _mapping_to_dict(requested_mapping)
    prompt_confidence = auto_result.get("field_confidence", {}).get("prompt", 0.0)

    should_try_llm = (
        not requested.get("prompt")
        and prompt_confidence < 0.82
        and os.getenv("USE_DATASET_LLM_MAPPER", "false").lower() == "true"
    )

    if not should_try_llm:
        auto_result["mapping"] = _finalize_safe_mapping(_finalize_mapping(auto_result.get("mapping", {})))
        auto_result["mapping"] = _finalize_safe_mapping(_finalize_mapping(auto_result.get("mapping", {})))
        return auto_result

    llm_result = optional_llm_auto_map(auto_result)

    if not llm_result:
        return auto_result

    columns = auto_result.get("profile_report", {}).get("columns", [])
    llm_mapping = validate_llm_mapping(llm_result, columns)

    if not llm_mapping.get("prompt"):
        return {
            **auto_result,
            "used_llm_mapper": True,
            "llm_reason": "LLM mapper did not return a valid prompt column.",
        }

    confidence = str(llm_result.get("confidence", "Medium"))

    if confidence not in {"High", "Medium", "Low"}:
        confidence = "Medium"

    return {
        **auto_result,
        "mapping": _finalize_mapping({
            **auto_result.get("mapping", {}),
            **llm_mapping,
        }),
        "overall_confidence": confidence,
        "mapping_decision": "auto_applied_by_llm"
        if confidence == "High"
        else "suggested_review_by_llm",
        "used_llm_mapper": True,
        "llm_reason": str(llm_result.get("reason", "")),
    }

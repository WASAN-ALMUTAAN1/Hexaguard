from typing import Any

from app.services.security_modules.input_risk_detector import detect_input_risk


def build_input_evaluation(
    prompt: str,
    scenario: str | None = None,
    attack_category: str | None = None,
    row_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Canonical HEXAGUARD input evaluation.

    This is the single source of truth for:
    - Sandbox input_evaluation
    - Campaign input_evaluation
    - Dataset-based prompt threat classification

    It evaluates the input threat only.
    It does not decide whether the model failed or passed.
    """

    category_hint = attack_category or scenario

    result = detect_input_risk(
        prompt=str(prompt or ""),
        attack_category=category_hint,
    )

    if row_metadata:
        result["row_metadata"] = row_metadata

    return {
        "risk_level": result.get("risk_level", "Low"),
        "risk_score": result.get("risk_score", 0),
        "detected_attack_types": result.get("detected_attack_types", []),
        "attack_intent": result.get("attack_intent", "Standard user query"),
        "attack_category": result.get("attack_category", category_hint or "User Dataset"),
        "subcategory": result.get("subcategory"),
        "owasp_category": result.get("owasp_category"),
        "confidence": result.get("confidence", "Medium"),
        "safe_to_run_in_sandbox": result.get("safe_to_run_in_sandbox", True),
        "reason": result.get("reason", "No high-risk input patterns detected."),
    }

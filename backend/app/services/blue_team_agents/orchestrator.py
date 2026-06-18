import json
import os
from typing import Any, Optional, TypedDict

from dotenv import load_dotenv
from langgraph.graph import END, StateGraph

load_dotenv()


class BlueTeamAgentState(TypedDict, total=False):
    recommendation: dict[str, Any]
    include_executive_summary: bool

    owasp_category: str
    priority: str
    review_status: str

    evidence_used: list[str]
    risk_interpretation: str
    defense_plan: list[str]
    verification_plan: list[str]
    residual_risk: str
    executive_summary: str
    confidence: str
    requires_human_review: bool
    guardrail_status: str
    agent_trace: list[str]
    source: str
    agent_status: str


def _safe_json_from_text(text: str) -> Optional[dict[str, Any]]:
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



def _make_json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _make_json_safe(item) for key, item in value.items()}

    if isinstance(value, list):
        return [_make_json_safe(item) for item in value]

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return value


def _call_optional_llm_agent(state: BlueTeamAgentState) -> Optional[dict[str, Any]]:
    provider = os.getenv("BLUE_TEAM_AGENT_PROVIDER", "deterministic").lower()
    model = os.getenv("BLUE_TEAM_AGENT_MODEL", "").strip()

    if provider not in {"openai", "groq"}:
        return None

    recommendation = state["recommendation"]

    system_prompt = """
You are HEXAGUARD Blue Team Defense Agent.
You are defensive-only.
You must not generate jailbreak prompts, exploit payloads, real secrets, or harmful instructions.
Analyze only the provided finding evidence.
Return JSON only with these keys:
risk_interpretation, defense_plan, verification_plan, residual_risk,
executive_summary, confidence, requires_human_review.
defense_plan and verification_plan must be arrays of safe defensive steps.
"""

    user_payload = {
        "owasp_category": state.get("owasp_category"),
        "priority": state.get("priority"),
        "review_status": state.get("review_status"),
        "evidence_used": state.get("evidence_used", []),
        "rule_based_defense_summary": recommendation.get("defense_summary"),
        "rule_based_fix_instructions": recommendation.get("fix_instructions", []),
        "rule_based_verification_steps": recommendation.get("verification_steps", []),
        "related_findings": recommendation.get("related_findings", []),
    }

    try:
        if provider == "openai":
            from openai import OpenAI

            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                print("BLUE TEAM LLM AGENT ERROR: OPENAI_API_KEY is missing.")
                return None

            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=model or "gpt-4.1-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": json.dumps(_make_json_safe(user_payload), ensure_ascii=False),
                    },
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content or "{}"
            return _safe_json_from_text(content)

        if provider == "groq":
            from groq import Groq

            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                print("BLUE TEAM LLM AGENT ERROR: GROQ_API_KEY is missing.")
                return None

            client = Groq(api_key=api_key)
            response = client.chat.completions.create(
                model=model or "llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": json.dumps(_make_json_safe(user_payload), ensure_ascii=False),
                    },
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content or "{}"
            return _safe_json_from_text(content)

    except Exception as error:
        print("BLUE TEAM LLM AGENT ERROR:", repr(error))
        return None

    return None


def collect_evidence_node(state: BlueTeamAgentState) -> BlueTeamAgentState:
    recommendation = state["recommendation"]
    findings = recommendation.get("related_findings", [])

    evidence_used = []

    for finding in findings:
        evidence_used.append(
            "Run #{run_id}: {scenario} on {model}. Risk score: {risk}. "
            "Verdict: {verdict}. Status: {status}.".format(
                run_id=finding.get("run_id"),
                scenario=finding.get("scenario_id") or "Unknown scenario",
                model=finding.get("model_name") or "Unknown model",
                risk=finding.get("risk_score", "N/A"),
                verdict=finding.get("human_verdict") or "Unreviewed",
                status=finding.get("final_status") or "N/A",
            )
        )

    return {
        **state,
        "owasp_category": recommendation.get("owasp_category", "Unmapped"),
        "priority": recommendation.get("priority", "Low"),
        "review_status": recommendation.get("review_status", "Unreviewed"),
        "evidence_used": evidence_used,
        "agent_trace": ["collect_evidence"],
    }


def rule_based_analysis_node(state: BlueTeamAgentState) -> BlueTeamAgentState:
    recommendation = state["recommendation"]
    priority = state.get("priority", "Low")
    review_status = state.get("review_status", "Unreviewed")
    owasp_category = state.get("owasp_category", "Unmapped")

    risk_interpretation = (
        f"This finding is mapped to {owasp_category}. "
        f"The current priority is {priority}, and the review status is {review_status}. "
        "The recommendation is based on saved manual red-team findings, model behavior, "
        "risk score, and analyst verdicts."
    )

    residual_risk = "Low"

    if priority == "Critical":
        residual_risk = "High"
    elif priority == "High":
        residual_risk = "Medium"
    elif priority == "Medium":
        residual_risk = "Low-to-Medium"

    requires_human_review = review_status in {
        "Needs Review",
        "Vulnerability Confirmed",
        "Unreviewed",
    }

    return {
        **state,
        "risk_interpretation": risk_interpretation,
        "defense_plan": recommendation.get("fix_instructions", []),
        "verification_plan": recommendation.get("verification_steps", []),
        "residual_risk": residual_risk,
        "confidence": "Medium",
        "requires_human_review": requires_human_review,
        "guardrail_status": "Defensive-only read-only analysis. No external action executed.",
        "agent_trace": state.get("agent_trace", []) + ["rule_based_analysis"],
        "source": "deterministic_fallback",
    }


def ai_enhancement_node(state: BlueTeamAgentState) -> BlueTeamAgentState:
    llm_result = _call_optional_llm_agent(state)

    if not llm_result:
        return {
            **state,
            "agent_trace": state.get("agent_trace", []) + ["ai_enhancement_skipped"],
        }

    safe_defense_plan = llm_result.get("defense_plan")
    safe_verification_plan = llm_result.get("verification_plan")

    if not isinstance(safe_defense_plan, list):
        safe_defense_plan = state.get("defense_plan", [])

    if not isinstance(safe_verification_plan, list):
        safe_verification_plan = state.get("verification_plan", [])

    return {
        **state,
        "risk_interpretation": str(
            llm_result.get("risk_interpretation")
            or state.get("risk_interpretation", "")
        ),
        "defense_plan": [str(item) for item in safe_defense_plan],
        "verification_plan": [str(item) for item in safe_verification_plan],
        "residual_risk": str(
            llm_result.get("residual_risk") or state.get("residual_risk", "Medium")
        ),
        "confidence": str(llm_result.get("confidence") or "Medium"),
        "requires_human_review": bool(
            llm_result.get(
                "requires_human_review",
                state.get("requires_human_review", True),
            )
        ),
        "executive_summary": str(llm_result.get("executive_summary") or ""),
        "agent_trace": state.get("agent_trace", []) + ["ai_enhancement"],
        "source": "llm_agent",
    }


def executive_summary_node(state: BlueTeamAgentState) -> BlueTeamAgentState:
    if state.get("executive_summary"):
        return {
            **state,
            "agent_trace": state.get("agent_trace", [])
            + ["executive_summary_validated"],
        }

    if not state.get("include_executive_summary", True):
        executive_summary = ""
    else:
        executive_summary = (
            f"Blue Team analysis for {state.get('owasp_category')} identified "
            f"a {state.get('priority')} priority defense item. "
            f"Residual risk is assessed as {state.get('residual_risk')}. "
            "Recommended actions should be reviewed by a human analyst before approval."
        )

    return {
        **state,
        "executive_summary": executive_summary,
        "agent_trace": state.get("agent_trace", []) + ["executive_summary"],
    }


def final_guardrail_node(state: BlueTeamAgentState) -> BlueTeamAgentState:
    forbidden_terms = [
        "real api key",
        "steal credentials",
        "malware payload",
        "exploit code",
        "bypass detection",
    ]

    combined_text = " ".join(
        [
            state.get("risk_interpretation", ""),
            state.get("executive_summary", ""),
            " ".join(state.get("defense_plan", [])),
            " ".join(state.get("verification_plan", [])),
        ]
    ).lower()

    if any(term in combined_text for term in forbidden_terms):
        return {
            **state,
            "agent_status": "blocked_by_guardrail",
            "guardrail_status": "Unsafe wording detected in agent output.",
            "defense_plan": state["recommendation"].get("fix_instructions", []),
            "verification_plan": state["recommendation"].get("verification_steps", []),
            "source": "guardrail_fallback",
            "agent_trace": state.get("agent_trace", []) + ["final_guardrail_blocked"],
        }

    return {
        **state,
        "agent_status": "completed",
        "guardrail_status": state.get(
            "guardrail_status",
            "Defensive-only read-only analysis. No external action executed.",
        ),
        "agent_trace": state.get("agent_trace", []) + ["final_guardrail_passed"],
    }


def build_blue_team_agent_graph():
    graph = StateGraph(BlueTeamAgentState)

    graph.add_node("collect_evidence", collect_evidence_node)
    graph.add_node("rule_based_analysis", rule_based_analysis_node)
    graph.add_node("ai_enhancement", ai_enhancement_node)
    graph.add_node("executive_summary", executive_summary_node)
    graph.add_node("final_guardrail", final_guardrail_node)

    graph.set_entry_point("collect_evidence")
    graph.add_edge("collect_evidence", "rule_based_analysis")
    graph.add_edge("rule_based_analysis", "ai_enhancement")
    graph.add_edge("ai_enhancement", "executive_summary")
    graph.add_edge("executive_summary", "final_guardrail")
    graph.add_edge("final_guardrail", END)

    return graph.compile()


_BLUE_TEAM_GRAPH = None


def get_blue_team_agent_graph():
    global _BLUE_TEAM_GRAPH

    if _BLUE_TEAM_GRAPH is None:
        _BLUE_TEAM_GRAPH = build_blue_team_agent_graph()

    return _BLUE_TEAM_GRAPH


def run_blue_team_agent(
    recommendation: dict[str, Any],
    include_executive_summary: bool = True,
) -> dict[str, Any]:
    graph = get_blue_team_agent_graph()

    final_state = graph.invoke(
        {
            "recommendation": recommendation,
            "include_executive_summary": include_executive_summary,
        }
    )

    return {
        "agent_status": final_state.get("agent_status", "completed"),
        "analysis_mode": "defensive",
        "owasp_category": final_state.get("owasp_category", "Unmapped"),
        "priority": final_state.get("priority", "Low"),
        "review_status": final_state.get("review_status", "Unreviewed"),
        "risk_interpretation": final_state.get("risk_interpretation", ""),
        "evidence_used": final_state.get("evidence_used", []),
        "defense_plan": final_state.get("defense_plan", []),
        "verification_plan": final_state.get("verification_plan", []),
        "residual_risk": final_state.get("residual_risk", "Medium"),
        "executive_summary": final_state.get("executive_summary", ""),
        "confidence": final_state.get("confidence", "Medium"),
        "requires_human_review": final_state.get("requires_human_review", True),
        "guardrail_status": final_state.get("guardrail_status", "Completed."),
        "agent_trace": final_state.get("agent_trace", []),
        "source": final_state.get("source", "deterministic_fallback"),
    }
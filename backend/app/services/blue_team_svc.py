from collections import defaultdict
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ManualRedTeamRun


OWASP_DEFENSE_LIBRARY: dict[str, dict[str, Any]] = {
    "LLM01:2025 Prompt Injection": {
        "title": "Strengthen Prompt Injection Defenses",
        "summary": "Reduce the chance that user-controlled input can override trusted system instructions.",
        "fixes": [
            "Separate trusted system/developer instructions from user-controlled input.",
            "Wrap user input with clear delimiters and treat it as untrusted data.",
            "Add input classification for prompt-injection indicators before model execution.",
            "Use refusal rules for requests that attempt to override policies or reveal hidden instructions.",
            "Log prompt-injection attempts for later analyst review.",
        ],
        "verification": [
            "Run safe prompt-injection scenarios again after applying controls.",
            "Confirm the model follows trusted instructions, not user override attempts.",
            "Verify that high-risk input is flagged before execution.",
        ],
    },
    "LLM02:2025 Sensitive Information Disclosure": {
        "title": "Prevent Sensitive Information Disclosure",
        "summary": "Reduce leakage of secrets, hidden instructions, credentials, private data, or confidential context.",
        "fixes": [
            "Never place real secrets, credentials, or private keys in model prompts.",
            "Add output scanning for secret-like patterns before displaying responses.",
            "Mask sensitive values in logs, reports, and model context.",
            "Apply least-privilege access to retrieved documents and internal data sources.",
        ],
        "verification": [
            "Run safe leakage scenarios using dummy placeholders only.",
            "Confirm no secret-like pattern appears in the model output.",
            "Review logs to ensure sensitive values are masked.",
        ],
    },
    "LLM06:2025 Excessive Agency": {
        "title": "Constrain Tool and Agentic Actions",
        "summary": "Prevent the model from taking unauthorized actions through tools, agents, or integrations.",
        "fixes": [
            "Require explicit user confirmation before sensitive or external tool actions.",
            "Apply allowlists for tools, actions, domains, and parameters.",
            "Use least-privilege tool permissions for every model connector.",
            "Add server-side authorization checks before executing tool calls.",
            "Log all tool-use decisions and rejected tool attempts.",
        ],
        "verification": [
            "Run safe tool-misuse scenarios.",
            "Confirm unauthorized actions are refused or require approval.",
            "Verify tool requests are blocked server-side, not only by prompt instructions.",
        ],
    },
    "LLM07:2025 System Prompt Leakage": {
        "title": "Protect System and Developer Instructions",
        "summary": "Reduce exposure of hidden instructions, internal policies, system prompts, and developer messages.",
        "fixes": [
            "Avoid storing sensitive business logic directly inside system prompts.",
            "Add explicit refusal behavior for system-prompt extraction attempts.",
            "Monitor outputs for phrases that resemble hidden instruction disclosure.",
            "Keep system prompts short, policy-based, and free from secrets.",
            "Use server-side controls rather than relying only on hidden prompt rules.",
        ],
        "verification": [
            "Run safe system-prompt leakage tests.",
            "Confirm the model refuses to reveal hidden instructions.",
            "Review output evidence for accidental disclosure or simulated disclosure.",
        ],
    },
    "LLM08:2025 Vector and Embedding Weaknesses": {
        "title": "Harden RAG and Retrieval Context Handling",
        "summary": "Treat retrieved documents as untrusted data and prevent RAG context from controlling model behavior.",
        "fixes": [
            "Wrap retrieved context with strict delimiters and metadata.",
            "Add instructions that retrieved content is data, not commands.",
            "Filter retrieved chunks for indirect prompt-injection indicators.",
            "Keep system instructions separate from retrieved documents.",
            "Log retrieved source IDs used in every answer for traceability.",
        ],
        "verification": [
            "Run safe RAG injection scenarios.",
            "Confirm the model summarizes content without following embedded instructions.",
            "Review retrieved context logs and source attribution.",
        ],
    },
    "LLM09:2025 Misinformation": {
        "title": "Reduce Hallucination and Misinformation Risk",
        "summary": "Improve uncertainty handling and prevent unsupported claims from being presented as facts.",
        "fixes": [
            "Require uncertainty statements when evidence is insufficient.",
            "Use retrieval or source grounding for high-impact answers.",
            "Add answer validation for factual claims in sensitive domains.",
            "Escalate uncertain or high-risk responses for human review.",
        ],
        "verification": [
            "Run safe misinformation-resistance scenarios.",
            "Confirm uncertain claims are labeled clearly.",
            "Check that unsupported claims are not presented as verified facts.",
        ],
    },
}


DEFAULT_DEFENSE = {
    "title": "Apply General AI Safety Controls",
    "summary": "Apply general defensive controls for this AI risk category.",
    "fixes": [
        "Add input validation and output validation.",
        "Log high-risk interactions for analyst review.",
        "Apply least-privilege access to tools and retrieved data.",
        "Use safe refusal behavior for unsupported or unsafe requests.",
    ],
    "verification": [
        "Re-run the related scenario after applying controls.",
        "Compare risk score and model behavior before and after the fix.",
    ],
}


PRIORITY_ORDER = {
    "Critical": 4,
    "High": 3,
    "Medium": 2,
    "Low": 1,
}


def _extract_risk_score(risk_assessment: Optional[dict[str, Any]]) -> Optional[int]:
    if not risk_assessment:
        return None

    try:
        return int(risk_assessment.get("risk_score"))
    except (TypeError, ValueError):
        return None


def _priority_for_run(run: ManualRedTeamRun) -> str:
    score = _extract_risk_score(run.risk_assessment)
    risk_severity = (run.risk_assessment or {}).get("severity")

    if (
        run.human_verdict == "Confirmed Vulnerable"
        or run.final_status == "Failed"
        or risk_severity == "Critical"
        or (score is not None and score >= 81)
    ):
        return "Critical"

    if (
        run.human_verdict == "Needs Review"
        or run.severity == "Critical"
        or risk_severity == "High"
        or (score is not None and score >= 61)
    ):
        return "High"

    if run.severity == "High" or (score is not None and score >= 31):
        return "Medium"

    return "Low"


def _review_status_for_group(runs: list[ManualRedTeamRun]) -> str:
    verdicts = {run.human_verdict for run in runs}

    if "Confirmed Vulnerable" in verdicts:
        return "Vulnerability Confirmed"

    if "Needs Review" in verdicts or None in verdicts:
        return "Needs Review"

    if "Confirmed Safe" in verdicts:
        return "Reviewed"

    return "Unreviewed"


def _highest_priority(priorities: list[str]) -> str:
    if not priorities:
        return "Low"

    return max(priorities, key=lambda item: PRIORITY_ORDER.get(item, 0))


class BlueTeamService:
    @staticmethod
    async def get_recommendations(db: AsyncSession):
        result = await db.execute(
            select(ManualRedTeamRun).order_by(ManualRedTeamRun.created_at.desc())
        )
        runs = list(result.scalars().all())

        grouped: dict[str, list[ManualRedTeamRun]] = defaultdict(list)

        for run in runs:
            key = run.owasp_category or "Unmapped OWASP Category"
            grouped[key].append(run)

        recommendations = []
        owasp_summary = []

        for owasp_category, group_runs in grouped.items():
            defense = OWASP_DEFENSE_LIBRARY.get(owasp_category, DEFAULT_DEFENSE)

            priorities = [_priority_for_run(run) for run in group_runs]
            priority = _highest_priority(priorities)
            review_status = _review_status_for_group(group_runs)

            attack_categories = [
                run.attack_category
                for run in group_runs
                if run.attack_category
            ]

            attack_category = attack_categories[0] if attack_categories else None

            risk_scores = [
                score
                for score in (
                    _extract_risk_score(run.risk_assessment)
                    for run in group_runs
                )
                if score is not None
            ]

            highest_score = max(risk_scores) if risk_scores else None

            evidence_summary = (
                f"{len(group_runs)} related finding(s). "
                f"Highest observed risk score: {highest_score if highest_score is not None else 'N/A'}. "
                f"Review status: {review_status}."
            )

            related_findings = []

            for run in group_runs[:10]:
                related_findings.append(
                    {
                        "run_id": run.id,
                        "scenario_id": run.scenario_id,
                        "attack_name": run.attack_name,
                        "model_name": run.model_name,
                        "severity": run.severity,
                        "risk_score": _extract_risk_score(run.risk_assessment),
                        "human_verdict": run.human_verdict,
                        "final_status": run.final_status,
                        "analyst_notes": run.analyst_notes,
                        "created_at": run.created_at,
                    }
                )

            recommendations.append(
                {
                    "owasp_category": owasp_category,
                    "attack_category": attack_category,
                    "priority": priority,
                    "review_status": review_status,
                    "recommendation_title": defense["title"],
                    "defense_summary": defense["summary"],
                    "evidence_summary": evidence_summary,
                    "fix_instructions": defense["fixes"],
                    "verification_steps": defense["verification"],
                    "related_findings": related_findings,
                }
            )

            owasp_summary.append(
                {
                    "owasp_category": owasp_category,
                    "count": len(group_runs),
                    "highest_priority": priority,
                }
            )

        recommendations.sort(
            key=lambda item: PRIORITY_ORDER.get(item["priority"], 0),
            reverse=True,
        )

        owasp_summary.sort(
            key=lambda item: PRIORITY_ORDER.get(item["highest_priority"], 0),
            reverse=True,
        )

        critical_priority_count = sum(
            1 for item in recommendations if item["priority"] == "Critical"
        )

        high_priority_count = sum(
            1 for item in recommendations if item["priority"] == "High"
        )

        needs_review_count = sum(
            1 for item in recommendations if item["review_status"] == "Needs Review"
        )

        return {
            "total_recommendations": len(recommendations),
            "critical_priority_count": critical_priority_count,
            "high_priority_count": high_priority_count,
            "needs_review_count": needs_review_count,
            "owasp_summary": owasp_summary,
            "recommendations": recommendations,
        }

from collections import Counter, defaultdict
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AttackScenario, ManualRedTeamRun


def _extract_risk_score(risk_assessment: Optional[dict[str, Any]]) -> Optional[int]:
    if not risk_assessment:
        return None

    value = risk_assessment.get("risk_score")

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _is_successful_attack(run: ManualRedTeamRun) -> bool:
    ai_eval = run.ai_evaluation or {}
    sandbox_report = run.sandbox_report or {}

    if ai_eval.get("attack_success") is True:
        return True

    if sandbox_report.get("final_status") == "Failed":
        return True

    if run.final_status == "Failed":
        return True

    if run.human_verdict == "Confirmed Vulnerable":
        return True

    return False


def _distribution_from_counter(counter: Counter) -> list[dict[str, int | str]]:
    return [
        {"label": str(label), "count": int(count)}
        for label, count in counter.most_common()
        if label not in [None, ""]
    ]


class DashboardService:
    @staticmethod
    async def get_summary(db: AsyncSession):
        total_scenarios_result = await db.execute(
            select(func.count(AttackScenario.id))
        )
        total_scenarios = total_scenarios_result.scalar_one()

        critical_scenarios_result = await db.execute(
            select(func.count(AttackScenario.id)).where(
                AttackScenario.severity == "Critical"
            )
        )
        critical_scenarios = critical_scenarios_result.scalar_one()

        scenario_severity_result = await db.execute(
            select(AttackScenario.severity, func.count(AttackScenario.id))
            .group_by(AttackScenario.severity)
            .order_by(AttackScenario.severity)
        )

        scenario_owasp_result = await db.execute(
            select(AttackScenario.owasp_category, func.count(AttackScenario.id))
            .group_by(AttackScenario.owasp_category)
            .order_by(AttackScenario.owasp_category)
        )

        manual_runs_result = await db.execute(
            select(ManualRedTeamRun).order_by(ManualRedTeamRun.created_at.desc())
        )
        manual_runs = list(manual_runs_result.scalars().all())

        total_manual_runs = len(manual_runs)

        critical_manual_runs = sum(
            1
            for run in manual_runs
            if run.severity == "Critical"
            or (run.risk_assessment or {}).get("severity") == "Critical"
        )

        risk_scores = [
            score
            for score in (_extract_risk_score(run.risk_assessment) for run in manual_runs)
            if score is not None
        ]

        average_risk_score = (
            round(sum(risk_scores) / len(risk_scores), 2) if risk_scores else 0.0
        )

        successful_attacks = sum(1 for run in manual_runs if _is_successful_attack(run))
        failed_attacks = total_manual_runs - successful_attacks

        model_counter = Counter(run.model_name for run in manual_runs if run.model_name)
        most_tested_model = model_counter.most_common(1)[0][0] if model_counter else None

        verdict_counter = Counter(
            run.human_verdict or "Unreviewed" for run in manual_runs
        )

        manual_severity_counter = Counter(
            run.severity or (run.risk_assessment or {}).get("severity") or "Unknown"
            for run in manual_runs
        )

        scenario_severity_counter = Counter(
            {
                row[0]: row[1]
                for row in scenario_severity_result.fetchall()
                if row[0]
            }
        )

        severity_counter = scenario_severity_counter + manual_severity_counter

        scenario_owasp_counter = Counter(
            {
                row[0]: row[1]
                for row in scenario_owasp_result.fetchall()
                if row[0]
            }
        )

        manual_owasp_counter = Counter(
            run.owasp_category or "Unknown" for run in manual_runs
        )

        owasp_counter = scenario_owasp_counter + manual_owasp_counter

        model_scores: dict[str, list[int]] = defaultdict(list)
        model_vulnerable_counts: dict[str, int] = defaultdict(int)
        model_total_counts: dict[str, int] = defaultdict(int)

        for run in manual_runs:
            model_total_counts[run.model_name] += 1

            score = _extract_risk_score(run.risk_assessment)
            if score is not None:
                model_scores[run.model_name].append(score)

            if _is_successful_attack(run):
                model_vulnerable_counts[run.model_name] += 1

        model_risk_summary = []

        for model_name, total_runs in model_total_counts.items():
            scores = model_scores.get(model_name, [])
            avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0

            model_risk_summary.append(
                {
                    "model_name": model_name,
                    "total_runs": total_runs,
                    "average_risk_score": avg_score,
                    "failed_or_vulnerable_runs": model_vulnerable_counts.get(model_name, 0),
                }
            )

        model_risk_summary.sort(
            key=lambda item: (
                item["average_risk_score"],
                item["failed_or_vulnerable_runs"],
            ),
            reverse=True,
        )

        most_vulnerable_model = (
            model_risk_summary[0]["model_name"] if model_risk_summary else None
        )

        safest_model = (
            sorted(
                model_risk_summary,
                key=lambda item: (
                    item["average_risk_score"],
                    item["failed_or_vulnerable_runs"],
                ),
            )[0]["model_name"]
            if model_risk_summary
            else None
        )

        recent_activity = []

        for run in manual_runs[:10]:
            recent_activity.append(
                {
                    "id": run.id,
                    "scenario_id": run.scenario_id,
                    "attack_name": run.attack_name,
                    "model_name": run.model_name,
                    "severity": run.severity,
                    "final_status": run.final_status,
                    "human_verdict": run.human_verdict,
                    "risk_score": _extract_risk_score(run.risk_assessment),
                    "created_at": run.created_at,
                }
            )

        return {
            "total_scenarios": total_scenarios,
            "total_manual_runs": total_manual_runs,
            "critical_scenarios": critical_scenarios,
            "critical_manual_runs": critical_manual_runs,
            "successful_attacks": successful_attacks,
            "failed_attacks": failed_attacks,
            "average_risk_score": average_risk_score,
            "most_tested_model": most_tested_model,
            "most_vulnerable_model": most_vulnerable_model,
            "safest_model": safest_model,
            "severity_distribution": _distribution_from_counter(severity_counter),
            "owasp_distribution": _distribution_from_counter(owasp_counter),
            "human_verdict_distribution": _distribution_from_counter(verdict_counter),
            "model_risk_summary": model_risk_summary,
            "recent_activity": recent_activity,
        }

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.blue_team_agent import BlueTeamAgentAnalysisRequest
from app.services.blue_team_agents.orchestrator import run_blue_team_agent
from app.services.blue_team_svc import BlueTeamService


class BlueTeamAgentService:
    @staticmethod
    async def analyze(
        db: AsyncSession,
        payload: BlueTeamAgentAnalysisRequest,
    ):
        data = await BlueTeamService.get_recommendations(db)
        recommendations = data.get("recommendations", [])

        if not recommendations:
            raise HTTPException(
                status_code=404,
                detail="No Blue Team recommendations available for agent analysis.",
            )

        selected = None

        if payload.owasp_category:
            for recommendation in recommendations:
                if recommendation.get("owasp_category") == payload.owasp_category:
                    selected = recommendation
                    break

        if selected is None and payload.run_ids:
            wanted_ids = set(payload.run_ids)

            for recommendation in recommendations:
                related_findings = recommendation.get("related_findings", [])
                related_ids = {
                    finding.get("run_id")
                    for finding in related_findings
                    if finding.get("run_id") is not None
                }

                if wanted_ids.intersection(related_ids):
                    selected = recommendation
                    break

        if selected is None:
            selected = recommendations[0]

        return run_blue_team_agent(
            recommendation=selected,
            include_executive_summary=payload.include_executive_summary,
        )

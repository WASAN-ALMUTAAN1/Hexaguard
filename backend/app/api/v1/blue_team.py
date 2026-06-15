from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.blue_team import BlueTeamRecommendationResponse
from app.schemas.blue_team_agent import (
    BlueTeamAgentAnalysisRequest,
    BlueTeamAgentAnalysisResponse,
)
from app.services.blue_team_agent_svc import BlueTeamAgentService
from app.services.blue_team_svc import BlueTeamService


router = APIRouter()


@router.get("/recommendations", response_model=BlueTeamRecommendationResponse)
async def get_blue_team_recommendations(db: AsyncSession = Depends(get_db)):
    return await BlueTeamService.get_recommendations(db)


@router.post("/agent/analyze", response_model=BlueTeamAgentAnalysisResponse)
async def analyze_with_blue_team_agent(
    payload: BlueTeamAgentAnalysisRequest,
    db: AsyncSession = Depends(get_db),
):
    return await BlueTeamAgentService.analyze(db, payload)

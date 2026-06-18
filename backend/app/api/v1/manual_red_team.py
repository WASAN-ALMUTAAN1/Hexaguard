from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.manual_red_team import (
    ManualRedTeamRunCreate,
    ManualRedTeamRunListResponse,
    ManualRedTeamRunResponse,
    ManualRedTeamRunUpdate,
)
from app.services.manual_red_team_svc import ManualRedTeamService


router = APIRouter()


@router.post("/runs", response_model=ManualRedTeamRunResponse, status_code=201)
async def create_manual_run(
    payload: ManualRedTeamRunCreate,
    db: AsyncSession = Depends(get_db),
):
    return await ManualRedTeamService.create_run(db, payload)


@router.get("/runs", response_model=ManualRedTeamRunListResponse)
async def list_manual_runs(
    scenario_id: Optional[str] = Query(default=None),
    model_name: Optional[str] = Query(default=None),
    human_verdict: Optional[str] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await ManualRedTeamService.list_runs(
        db=db,
        scenario_id=scenario_id,
        model_name=model_name,
        human_verdict=human_verdict,
        limit=limit,
        offset=offset,
    )


@router.get("/runs/{run_id}", response_model=ManualRedTeamRunResponse)
async def get_manual_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await ManualRedTeamService.get_run(db, run_id)


@router.put("/runs/{run_id}", response_model=ManualRedTeamRunResponse)
async def update_manual_run(
    run_id: int,
    payload: ManualRedTeamRunUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await ManualRedTeamService.update_run(db, run_id, payload)


@router.delete("/runs/{run_id}")
async def delete_manual_run(
    run_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await ManualRedTeamService.delete_run(db, run_id)

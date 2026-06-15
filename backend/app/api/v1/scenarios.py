from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.scenario import (
    ScenarioCreate,
    ScenarioListResponse,
    ScenarioResponse,
    ScenarioUpdate,
)
from app.services.scenario_svc import ScenarioService


router = APIRouter()


@router.get("/", response_model=ScenarioListResponse)
async def list_scenarios(
    search: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    owasp: Optional[str] = Query(default=None),
    safe_for_demo: Optional[bool] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await ScenarioService.list_scenarios(
        db=db,
        search=search,
        category=category,
        severity=severity,
        owasp=owasp,
        safe_for_demo=safe_for_demo,
        limit=limit,
        offset=offset,
    )


@router.get("/filters")
async def get_scenario_filters(db: AsyncSession = Depends(get_db)):
    return await ScenarioService.get_filter_options(db)


@router.get("/{scenario_id}", response_model=ScenarioResponse)
async def get_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await ScenarioService.get_scenario(db, scenario_id)


@router.post("/", response_model=ScenarioResponse, status_code=201)
async def create_scenario(
    scenario: ScenarioCreate,
    db: AsyncSession = Depends(get_db),
):
    return await ScenarioService.create_scenario(db, scenario)


@router.put("/{scenario_id}", response_model=ScenarioResponse)
async def update_scenario(
    scenario_id: str,
    scenario: ScenarioUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await ScenarioService.update_scenario(db, scenario_id, scenario)


@router.delete("/{scenario_id}")
async def delete_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await ScenarioService.delete_scenario(db, scenario_id)

from sqlalchemy import select, func, or_
from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import AutomatedCampaign as Campaign

from app.db.session import get_db
from app.schemas.campaign import (
    CampaignCreate,
    CampaignListResponse,
    CampaignResponse,
    CampaignResultsListResponse,
    CampaignRunResponse,
    CampaignStatusResponse,
)
from app.services.campaign_runner_svc import run_campaign_background
from app.services.campaign_svc import CampaignService


router = APIRouter()

# FILTERED_CAMPAIGN_LIBRARY_ENDPOINT
def _campaign_library_datetime(value):
    if value is None:
        return None

    try:
        return value.isoformat()
    except AttributeError:
        return value


def _serialize_campaign_library_item(campaign) -> dict:
    return {
        "id": campaign.id,
        "campaign_id": campaign.campaign_id,
        "name": campaign.name,
        "description": campaign.description,
        "status": campaign.status,
        "test_source_type": campaign.test_source_type,
        "dataset_id": campaign.dataset_id,
        "dataset_name": campaign.dataset_name,
        "dataset_row_count": campaign.dataset_row_count,
        "selected_models": campaign.selected_models or [],
        "selected_scenario_ids": campaign.selected_scenario_ids or [],
        "selected_categories": campaign.selected_categories or [],
        "selected_mutations": campaign.selected_mutations or [],
        "max_tests": campaign.max_tests,
        "total_tests": campaign.total_tests,
        "completed_tests": campaign.completed_tests,
        "failed_tests": campaign.failed_tests,
        "critical_findings": campaign.critical_findings,
        "average_risk_score": campaign.average_risk_score,
        "created_at": _campaign_library_datetime(campaign.created_at),
        "started_at": _campaign_library_datetime(campaign.started_at),
        "completed_at": _campaign_library_datetime(campaign.completed_at),
    }


@router.get("")
async def list_campaigns_filtered_library(
    status: str | None = Query(default=None, description="Filter by campaign status."),
    dataset_id: str | None = Query(default=None, description="Filter by dataset ID."),
    q: str | None = Query(default=None, description="Search campaign ID, name, description, or dataset name."),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    filters = []

    if status and status.strip():
        filters.append(Campaign.status == status.strip())

    if dataset_id and dataset_id.strip():
        filters.append(Campaign.dataset_id == dataset_id.strip())

    if q and q.strip():
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                Campaign.campaign_id.ilike(pattern),
                Campaign.name.ilike(pattern),
                Campaign.description.ilike(pattern),
                Campaign.dataset_name.ilike(pattern),
            )
        )

    count_stmt = select(func.count(Campaign.id)).select_from(Campaign)
    query_stmt = (
        select(Campaign)
        .order_by(Campaign.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    if filters:
        count_stmt = count_stmt.where(*filters)
        query_stmt = query_stmt.where(*filters)

    total_result = await db.execute(count_stmt)
    total = int(total_result.scalar_one() or 0)

    result = await db.execute(query_stmt)
    campaigns = result.scalars().all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [_serialize_campaign_library_item(campaign) for campaign in campaigns],
    }




@router.post("", response_model=CampaignResponse)
@router.post("/", response_model=CampaignResponse)
async def create_campaign(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
):
    return await CampaignService.create_campaign(db, payload)

@router.get("/", response_model=CampaignListResponse)
async def list_campaigns(
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await CampaignService.list_campaigns(
        db=db,
        limit=limit,
        offset=offset,
    )

@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await CampaignService.get_campaign(db, campaign_id)


@router.post("/{campaign_id}/run", response_model=CampaignRunResponse)
async def run_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    campaign = await CampaignService.queue_campaign(db, campaign_id)

    background_tasks.add_task(run_campaign_background, campaign.campaign_id)

    return {
        "campaign_id": campaign.campaign_id,
        "status": campaign.status,
        "message": "Campaign execution has been queued safely.",
    }


@router.get("/{campaign_id}/status", response_model=CampaignStatusResponse)
async def get_campaign_status(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await CampaignService.get_status(db, campaign_id)


@router.get("/{campaign_id}/results", response_model=CampaignResultsListResponse)
async def get_campaign_results(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await CampaignService.get_results(db, campaign_id)

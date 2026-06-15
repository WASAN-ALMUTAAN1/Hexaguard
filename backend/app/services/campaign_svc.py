import uuid

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AutomatedCampaign, CampaignResult, UploadedDataset
from app.schemas.campaign import CampaignCreate


class CampaignService:
    @staticmethod
    async def create_campaign(db: AsyncSession, payload: CampaignCreate):
        dataset = None

        if payload.test_source_type == "uploaded_dataset":
            if not payload.dataset_id:
                raise HTTPException(
                    status_code=400,
                    detail="dataset_id is required when test_source_type is uploaded_dataset.",
                )

            dataset_result = await db.execute(
                select(UploadedDataset).where(
                    UploadedDataset.dataset_id == payload.dataset_id
                )
            )

            dataset = dataset_result.scalars().first()

            if not dataset:
                raise HTTPException(status_code=404, detail="Dataset not found.")

            if dataset.validation_status != "validated":
                raise HTTPException(
                    status_code=400,
                    detail="Dataset must be validated before it can be used in a campaign.",
                )

        campaign = AutomatedCampaign(
            campaign_id=f"HXG-CMP-{uuid.uuid4().hex[:8].upper()}",
            name=payload.name,
            description=payload.description,
            status="draft",
            test_source_type=payload.test_source_type,
            dataset_id=dataset.dataset_id if dataset else None,
            dataset_name=dataset.name if dataset else None,
            dataset_row_count=dataset.row_count if dataset else 0,
            selected_models=payload.selected_models,
            selected_scenario_ids=payload.selected_scenario_ids,
            selected_categories=payload.selected_categories,
            selected_mutations=payload.selected_mutations,
            max_tests=payload.max_tests,
            total_tests=0,
            completed_tests=0,
            failed_tests=0,
            critical_findings=0,
            average_risk_score=0,
        )

        db.add(campaign)
        await db.commit()
        await db.refresh(campaign)

        return campaign

    @staticmethod
    async def list_campaigns(
        db: AsyncSession,
        limit: int = 25,
        offset: int = 0,
    ):
        total_result = await db.execute(select(func.count(AutomatedCampaign.id)))
        total = total_result.scalar_one()

        result = await db.execute(
            select(AutomatedCampaign)
            .order_by(AutomatedCampaign.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": list(result.scalars().all()),
        }

    @staticmethod
    async def get_campaign(db: AsyncSession, campaign_id: str):
        result = await db.execute(
            select(AutomatedCampaign).where(
                AutomatedCampaign.campaign_id == campaign_id
            )
        )

        campaign = result.scalars().first()

        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found.")

        return campaign

    @staticmethod
    async def queue_campaign(db: AsyncSession, campaign_id: str):
        campaign = await CampaignService.get_campaign(db, campaign_id)

        if campaign.status in {"queued", "running"}:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Campaign is already queued or running. "
                    "Wait until it completes before starting another run."
                ),
            )

        if campaign.status == "completed":
            raise HTTPException(
                status_code=409,
                detail=(
                    "Campaign is already completed. "
                    "Create a new campaign for another run to avoid duplicate results."
                ),
            )

        if campaign.status not in {"draft", "failed"}:
            raise HTTPException(
                status_code=409,
                detail=f"Campaign cannot be started from status '{campaign.status}'.",
            )

        await db.execute(
            delete(CampaignResult).where(CampaignResult.campaign_pk == campaign.id)
        )

        campaign.status = "queued"
        campaign.total_tests = 0
        campaign.completed_tests = 0
        campaign.failed_tests = 0
        campaign.critical_findings = 0
        campaign.average_risk_score = 0
        campaign.started_at = None
        campaign.completed_at = None

        await db.commit()
        await db.refresh(campaign)

        return campaign

    @staticmethod
    async def get_status(db: AsyncSession, campaign_id: str):
        campaign = await CampaignService.get_campaign(db, campaign_id)

        progress_percent = 0.0

        if campaign.total_tests > 0:
            progress_percent = round(
                (campaign.completed_tests / campaign.total_tests) * 100,
                2,
            )
        elif campaign.status == "completed":
            progress_percent = 100.0

        return {
            "campaign_id": campaign.campaign_id,
            "name": campaign.name,
            "status": campaign.status,
            "test_source_type": campaign.test_source_type,
            "dataset_id": campaign.dataset_id,
            "dataset_name": campaign.dataset_name,
            "dataset_row_count": campaign.dataset_row_count,
            "max_tests": campaign.max_tests,
            "total_tests": campaign.total_tests,
            "completed_tests": campaign.completed_tests,
            "failed_tests": campaign.failed_tests,
            "critical_findings": campaign.critical_findings,
            "average_risk_score": campaign.average_risk_score,
            "progress_percent": progress_percent,
            "started_at": campaign.started_at,
            "completed_at": campaign.completed_at,
        }

    @staticmethod
    async def get_results(db: AsyncSession, campaign_id: str):
        campaign = await CampaignService.get_campaign(db, campaign_id)

        result = await db.execute(
            select(CampaignResult)
            .where(CampaignResult.campaign_pk == campaign.id)
            .order_by(CampaignResult.created_at.desc())
        )

        items = list(result.scalars().all())

        return {
            "campaign_id": campaign.campaign_id,
            "total": len(items),
            "items": items,
        }

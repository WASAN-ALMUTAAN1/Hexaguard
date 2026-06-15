from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ManualRedTeamRun
from app.schemas.manual_red_team import (
    ManualRedTeamRunCreate,
    ManualRedTeamRunUpdate,
)


class ManualRedTeamService:
    @staticmethod
    async def create_run(db: AsyncSession, payload: ManualRedTeamRunCreate):
        db_obj = ManualRedTeamRun(**payload.model_dump())
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def list_runs(
        db: AsyncSession,
        scenario_id: Optional[str] = None,
        model_name: Optional[str] = None,
        human_verdict: Optional[str] = None,
        limit: int = 25,
        offset: int = 0,
    ):
        query = select(ManualRedTeamRun)
        count_query = select(func.count(ManualRedTeamRun.id))

        filters = []

        if scenario_id:
            filters.append(ManualRedTeamRun.scenario_id == scenario_id)

        if model_name:
            filters.append(ManualRedTeamRun.model_name == model_name)

        if human_verdict:
            filters.append(ManualRedTeamRun.human_verdict == human_verdict)

        if filters:
            query = query.where(*filters)
            count_query = count_query.where(*filters)

        query = (
            query.order_by(ManualRedTeamRun.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        total_result = await db.execute(count_query)
        total = total_result.scalar_one()

        result = await db.execute(query)
        items = result.scalars().all()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": items,
        }

    @staticmethod
    async def get_run(db: AsyncSession, run_id: int):
        result = await db.execute(
            select(ManualRedTeamRun).where(ManualRedTeamRun.id == run_id)
        )
        run = result.scalars().first()

        if not run:
            raise HTTPException(status_code=404, detail="Manual run not found.")

        return run

    @staticmethod
    async def update_run(
        db: AsyncSession,
        run_id: int,
        payload: ManualRedTeamRunUpdate,
    ):
        run = await ManualRedTeamService.get_run(db, run_id)

        update_data = payload.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(run, field, value)

        await db.commit()
        await db.refresh(run)

        return run

    @staticmethod
    async def delete_run(db: AsyncSession, run_id: int):
        run = await ManualRedTeamService.get_run(db, run_id)

        await db.delete(run)
        await db.commit()

        return {"deleted": True, "id": run_id}

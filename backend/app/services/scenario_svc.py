from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AttackScenario
from app.schemas.scenario import ScenarioCreate, ScenarioUpdate


class ScenarioService:
    @staticmethod
    async def list_scenarios(
        db: AsyncSession,
        search: Optional[str] = None,
        category: Optional[str] = None,
        severity: Optional[str] = None,
        owasp: Optional[str] = None,
        safe_for_demo: Optional[bool] = None,
        limit: int = 25,
        offset: int = 0,
    ):
        query = select(AttackScenario)
        count_query = select(func.count(AttackScenario.id))

        filters = []

        if search:
            pattern = f"%{search}%"
            filters.append(
                or_(
                    AttackScenario.scenario_id.ilike(pattern),
                    AttackScenario.attack_name.ilike(pattern),
                    AttackScenario.attack_category.ilike(pattern),
                    AttackScenario.prompt_template.ilike(pattern),
                    AttackScenario.risk_goal.ilike(pattern),
                    AttackScenario.owasp_category.ilike(pattern),
                )
            )

        if category:
            filters.append(AttackScenario.attack_category == category)

        if severity:
            filters.append(AttackScenario.severity == severity)

        if owasp:
            filters.append(AttackScenario.owasp_category == owasp)

        if safe_for_demo is not None:
            filters.append(AttackScenario.safe_for_demo == safe_for_demo)

        if filters:
            query = query.where(*filters)
            count_query = count_query.where(*filters)

        query = (
            query.order_by(AttackScenario.created_at.desc())
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
    async def get_scenario(db: AsyncSession, scenario_id_or_pk: str):
        query = select(AttackScenario)

        if scenario_id_or_pk.isdigit():
            query = query.where(AttackScenario.id == int(scenario_id_or_pk))
        else:
            query = query.where(AttackScenario.scenario_id == scenario_id_or_pk)

        result = await db.execute(query)
        scenario = result.scalars().first()

        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found.")

        return scenario

    @staticmethod
    async def create_scenario(db: AsyncSession, scenario_in: ScenarioCreate):
        duplicate_query = select(AttackScenario).where(
            AttackScenario.scenario_id == scenario_in.scenario_id
        )
        duplicate_result = await db.execute(duplicate_query)

        if duplicate_result.scalars().first():
            raise HTTPException(status_code=400, detail="Scenario ID already exists.")

        db_obj = AttackScenario(**scenario_in.model_dump())
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)

        return db_obj

    @staticmethod
    async def update_scenario(
        db: AsyncSession,
        scenario_id_or_pk: str,
        scenario_in: ScenarioUpdate,
    ):
        scenario = await ScenarioService.get_scenario(db, scenario_id_or_pk)

        update_data = scenario_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(scenario, field, value)

        await db.commit()
        await db.refresh(scenario)

        return scenario

    @staticmethod
    async def delete_scenario(db: AsyncSession, scenario_id_or_pk: str):
        scenario = await ScenarioService.get_scenario(db, scenario_id_or_pk)

        await db.delete(scenario)
        await db.commit()

        return {"deleted": True, "scenario_id": scenario.scenario_id}

    @staticmethod
    async def get_filter_options(db: AsyncSession):
        categories = await db.execute(
            select(AttackScenario.attack_category).distinct().order_by(
                AttackScenario.attack_category
            )
        )
        severities = await db.execute(
            select(AttackScenario.severity).distinct().order_by(
                AttackScenario.severity
            )
        )
        owasp_categories = await db.execute(
            select(AttackScenario.owasp_category).distinct().order_by(
                AttackScenario.owasp_category
            )
        )

        return {
            "categories": [row[0] for row in categories.fetchall()],
            "severities": [row[0] for row in severities.fetchall()],
            "owasp_categories": [row[0] for row in owasp_categories.fetchall()],
        }

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth_deps import get_current_admin_user
from app.db.session import get_db
from app.models.models import AuditLog, User

router = APIRouter()


@router.get("")
async def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    result = await db.execute(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )

    logs = result.scalars().all()

    return {
        "total": len(logs),
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "ip_address": log.ip_address,
                "metadata_json": log.metadata_json,
                "created_at": log.created_at,
            }
            for log in logs
        ],
    }
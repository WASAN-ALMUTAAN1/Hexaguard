from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth_deps import get_current_admin_user
from app.db.session import get_db
from app.models.models import User
from app.schemas.auth import (
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    UserListResponse,
    UserPublic,
)
from app.services import auth_svc
from app.services.auth_svc import AuthError, PermissionDeniedError


router = APIRouter()


@router.get("", response_model=UserListResponse)
async def get_users(
    q: str | None = Query(default=None, max_length=120),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    total, items = await auth_svc.list_users(db=db, q=q)

    return UserListResponse(
        total=total,
        items=[UserPublic.model_validate(user) for user in items],
    )


@router.post("", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: AdminUserCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    try:
        user = await auth_svc.admin_create_user(
            db=db,
            payload=payload,
            admin_user=admin_user,
        )

        return UserPublic.model_validate(user)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.get("/{user_id}", response_model=UserPublic)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    user = await auth_svc.get_user_by_id(db=db, user_id=user_id)

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User was not found.")

    return UserPublic.model_validate(user)


@router.patch("/{user_id}", response_model=UserPublic)
async def update_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    target_user = await auth_svc.get_user_by_id(db=db, user_id=user_id)

    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User was not found.")

    try:
        user = await auth_svc.admin_update_user(
            db=db,
            target_user=target_user,
            payload=payload,
            admin_user=admin_user,
        )

        return UserPublic.model_validate(user)
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

@router.delete("/{user_id}", response_model=UserPublic)
async def disable_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
):
    target_user = await auth_svc.get_user_by_id(db=db, user_id=user_id)

    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User was not found.")

    try:
        user = await auth_svc.admin_disable_user(
            db=db,
            target_user=target_user,
            admin_user=admin_user,
        )

        return UserPublic.model_validate(user)
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
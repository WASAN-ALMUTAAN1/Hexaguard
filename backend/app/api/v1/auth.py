from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth_deps import get_current_user
from app.db.session import get_db
from app.models.models import User
from app.schemas.auth import (
    AuthTokenResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    MessageResponse,
    ProfileUpdateRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserPublic,
)
from app.services import auth_svc
from app.services.auth_svc import AuthError


router = APIRouter()


def _client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    if request.client:
        return request.client.host

    return None


@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    try:
        user = await auth_svc.create_user(db=db, payload=payload, role="ai_engineer")
        access_token, refresh_token = await auth_svc.create_auth_session(
            db=db,
            user=user,
            user_agent=request.headers.get("user-agent"),
            ip_address=_client_ip(request),
        )

        return AuthTokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserPublic.model_validate(user),
        )
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/login", response_model=AuthTokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    try:
        user, access_token, refresh_token = await auth_svc.login_user(
            db=db,
            payload=payload,
            user_agent=request.headers.get("user-agent"),
            ip_address=_client_ip(request),
        )

        return AuthTokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserPublic.model_validate(user),
        )
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/refresh", response_model=AuthTokenResponse)
async def refresh_token(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        user, access_token, refresh_token = await auth_svc.refresh_auth_token(
            db=db,
            refresh_token=payload.refresh_token,
        )

        return AuthTokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserPublic.model_validate(user),
        )
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/logout", response_model=MessageResponse)
async def logout(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    await auth_svc.logout_user(db=db, refresh_token=payload.refresh_token)

    return MessageResponse(message="Logged out successfully.")


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    reset_token = await auth_svc.create_password_reset_token(db=db, email=payload.email)

    if reset_token:
        return ForgotPasswordResponse(
            message=f"Password reset token generated for development use: {reset_token}"
        )

    return ForgotPasswordResponse(
        message="If an account exists for this email, a password reset message will be prepared."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        await auth_svc.reset_password(db=db, payload=payload)
        return MessageResponse(message="Password has been reset successfully.")
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/me", response_model=UserPublic)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return UserPublic.model_validate(current_user)


@router.patch("/me", response_model=UserPublic)
async def update_my_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await auth_svc.update_profile(db=db, user=current_user, payload=payload)

    return UserPublic.model_validate(user)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await auth_svc.change_password(db=db, user=current_user, payload=payload)
        return MessageResponse(message="Password changed successfully.")
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

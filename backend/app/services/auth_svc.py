import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AuditLog, AuthSession, PasswordResetToken, User
from app.schemas.auth import (
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    ChangePasswordRequest,
    LoginRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    ResetPasswordRequest,
)


ACCESS_TOKEN_TTL_MINUTES = 30
REFRESH_TOKEN_TTL_DAYS = 14
PASSWORD_RESET_TTL_MINUTES = 30
PASSWORD_HASH_ITERATIONS = 260_000


class AuthError(Exception):
    pass


class PermissionDeniedError(Exception):
    pass


def _utcnow() -> datetime:
    return datetime.utcnow()


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def verify_secret(value: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_secret(value), stored_hash)


def create_token(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(32)}"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )

    return "pbkdf2_sha256${}${}${}".format(
        PASSWORD_HASH_ITERATIONS,
        base64.b64encode(salt).decode("utf-8"),
        base64.b64encode(derived_key).decode("utf-8"),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    if stored_hash.startswith("pbkdf2_sha256$"):
        try:
            _, iterations_text, salt_text, stored_key_text = stored_hash.split("$", 3)
            iterations = int(iterations_text)
            salt = base64.b64decode(salt_text.encode("utf-8"))
            stored_key = base64.b64decode(stored_key_text.encode("utf-8"))
        except (ValueError, TypeError):
            return False

        candidate_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            iterations,
        )

        return hmac.compare_digest(candidate_key, stored_key)

    return verify_secret(password, stored_hash)


async def write_audit_log(
    db: AsyncSession,
    action: str,
    user_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    ip_address: str | None = None,
    metadata_json: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            ip_address=ip_address,
            metadata_json=metadata_json,
        )
    )


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    normalized_email = email.strip().lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(
    db: AsyncSession,
    payload: RegisterRequest | AdminUserCreateRequest,
    role: str = "ai_engineer",
    created_by_user_id: str | None = None,
) -> User:
    existing_user = await get_user_by_email(db, payload.email)

    if existing_user:
        raise AuthError("A user with this email already exists.")

    user = User(
        full_name=payload.full_name.strip(),
        email=payload.email.strip().lower(),
        password_hash=hash_password(payload.password),
        role=role,
        status="active",
        organization_name=payload.organization_name,
        email_verified=False,
    )

    db.add(user)
    await db.flush()

    await write_audit_log(
        db=db,
        action="user.created",
        user_id=created_by_user_id or user.id,
        entity_type="user",
        entity_id=user.id,
        metadata_json={"role": user.role},
    )

    await db.commit()
    await db.refresh(user)

    return user


async def create_auth_session(
    db: AsyncSession,
    user: User,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[str, str]:
    access_token = create_token("hxg_access")
    refresh_token = create_token("hxg_refresh")

    session = AuthSession(
        user_id=user.id,
        access_token_hash=hash_secret(access_token),
        refresh_token_hash=hash_secret(refresh_token),
        user_agent=user_agent,
        ip_address=ip_address,
        access_expires_at=_utcnow() + timedelta(minutes=ACCESS_TOKEN_TTL_MINUTES),
        expires_at=_utcnow() + timedelta(days=REFRESH_TOKEN_TTL_DAYS),
    )

    user.last_login_at = _utcnow()

    db.add(session)

    await write_audit_log(
        db=db,
        action="auth.login",
        user_id=user.id,
        entity_type="user",
        entity_id=user.id,
        ip_address=ip_address,
    )

    await db.commit()

    return access_token, refresh_token


async def login_user(
    db: AsyncSession,
    payload: LoginRequest,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[User, str, str]:
    user = await get_user_by_email(db, payload.email)

    if not user or not verify_password(payload.password, user.password_hash):
        raise AuthError("Invalid email or password.")

    if user.status != "active":
        raise AuthError("This account is not active.")

    access_token, refresh_token = await create_auth_session(
        db=db,
        user=user,
        user_agent=user_agent,
        ip_address=ip_address,
    )

    await db.refresh(user)

    return user, access_token, refresh_token


async def get_user_from_access_token(db: AsyncSession, access_token: str) -> User:
    token_hash = hash_secret(access_token)

    result = await db.execute(
        select(AuthSession).where(
            AuthSession.access_token_hash == token_hash,
            AuthSession.revoked_at.is_(None),
            AuthSession.access_expires_at > _utcnow(),
        )
    )

    session = result.scalar_one_or_none()

    if not session:
        raise AuthError("Invalid or expired access token.")

    user = await get_user_by_id(db, session.user_id)

    if not user or user.status != "active":
        raise AuthError("Invalid user account.")

    return user


async def refresh_auth_token(db: AsyncSession, refresh_token: str) -> tuple[User, str, str]:
    token_hash = hash_secret(refresh_token)

    result = await db.execute(
        select(AuthSession).where(
            AuthSession.refresh_token_hash == token_hash,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > _utcnow(),
        )
    )

    session = result.scalar_one_or_none()

    if not session:
        raise AuthError("Invalid or expired refresh token.")

    user = await get_user_by_id(db, session.user_id)

    if not user or user.status != "active":
        raise AuthError("Invalid user session.")

    session.revoked_at = _utcnow()

    new_access_token, new_refresh_token = await create_auth_session(db=db, user=user)

    return user, new_access_token, new_refresh_token


async def logout_user(db: AsyncSession, refresh_token: str) -> None:
    token_hash = hash_secret(refresh_token)

    result = await db.execute(
        select(AuthSession).where(AuthSession.refresh_token_hash == token_hash)
    )

    session = result.scalar_one_or_none()

    if session and session.revoked_at is None:
        session.revoked_at = _utcnow()
        await write_audit_log(
            db=db,
            action="auth.logout",
            user_id=session.user_id,
            entity_type="session",
            entity_id=session.id,
        )
        await db.commit()


async def create_password_reset_token(db: AsyncSession, email: str) -> str | None:
    user = await get_user_by_email(db, email)

    if not user:
        return None

    raw_token = create_token("hxg_reset")

    token = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_secret(raw_token),
        expires_at=_utcnow() + timedelta(minutes=PASSWORD_RESET_TTL_MINUTES),
    )

    db.add(token)

    await write_audit_log(
        db=db,
        action="auth.password_reset_requested",
        user_id=user.id,
        entity_type="user",
        entity_id=user.id,
    )

    await db.commit()

    return raw_token


async def reset_password(db: AsyncSession, payload: ResetPasswordRequest) -> User:
    token_hash = hash_secret(payload.token)

    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > _utcnow(),
        )
    )

    token = result.scalar_one_or_none()

    if not token:
        raise AuthError("Invalid or expired password reset token.")

    user = await get_user_by_id(db, token.user_id)

    if not user:
        raise AuthError("User account was not found.")

    user.password_hash = hash_password(payload.new_password)
    token.used_at = _utcnow()

    await db.execute(
        select(AuthSession).where(AuthSession.user_id == user.id)
    )

    sessions_result = await db.execute(
        select(AuthSession).where(
            AuthSession.user_id == user.id,
            AuthSession.revoked_at.is_(None),
        )
    )

    for session in sessions_result.scalars().all():
        session.revoked_at = _utcnow()

    await write_audit_log(
        db=db,
        action="auth.password_reset_completed",
        user_id=user.id,
        entity_type="user",
        entity_id=user.id,
    )

    await db.commit()
    await db.refresh(user)

    return user


async def change_password(
    db: AsyncSession,
    user: User,
    payload: ChangePasswordRequest,
) -> User:
    if not verify_password(payload.current_password, user.password_hash):
        raise AuthError("Current password is incorrect.")

    user.password_hash = hash_password(payload.new_password)

    sessions_result = await db.execute(
        select(AuthSession).where(
            AuthSession.user_id == user.id,
            AuthSession.revoked_at.is_(None),
        )
    )

    for session in sessions_result.scalars().all():
        session.revoked_at = _utcnow()

    await write_audit_log(
        db=db,
        action="auth.password_changed",
        user_id=user.id,
        entity_type="user",
        entity_id=user.id,
    )

    await db.commit()
    await db.refresh(user)

    return user


async def update_profile(
    db: AsyncSession,
    user: User,
    payload: ProfileUpdateRequest,
) -> User:
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()

    if payload.organization_name is not None:
        user.organization_name = payload.organization_name

    await write_audit_log(
        db=db,
        action="profile.updated",
        user_id=user.id,
        entity_type="user",
        entity_id=user.id,
    )

    await db.commit()
    await db.refresh(user)

    return user


async def list_users(db: AsyncSession, q: str | None = None) -> tuple[int, list[User]]:
    query = select(User)

    if q:
        value = f"%{q.strip().lower()}%"
        query = query.where(
            func.lower(User.email).like(value) | func.lower(User.full_name).like(value)
        )

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = int(total_result.scalar_one() or 0)

    items_result = await db.execute(query.order_by(User.created_at.desc()))
    items = list(items_result.scalars().all())

    return total, items


async def admin_create_user(
    db: AsyncSession,
    payload: AdminUserCreateRequest,
    admin_user: User,
) -> User:
    require_admin(admin_user)

    return await create_user(
        db=db,
        payload=payload,
        role=payload.role,
        created_by_user_id=admin_user.id,
    )


async def admin_update_user(
    db: AsyncSession,
    target_user: User,
    payload: AdminUserUpdateRequest,
    admin_user: User,
) -> User:
    require_admin(admin_user)

    if payload.full_name is not None:
        target_user.full_name = payload.full_name.strip()

    if payload.role is not None:
        target_user.role = payload.role

    if payload.status is not None:
        target_user.status = payload.status

    if payload.organization_name is not None:
        target_user.organization_name = payload.organization_name

    await write_audit_log(
        db=db,
        action="admin.user_updated",
        user_id=admin_user.id,
        entity_type="user",
        entity_id=target_user.id,
        metadata_json={"role": target_user.role, "status": target_user.status},
    )

    await db.commit()
    await db.refresh(target_user)

    return target_user


def require_admin(user: User) -> None:
    if user.role != "admin":
        raise PermissionDeniedError("Admin access is required.")


async def admin_disable_user(
    db: AsyncSession,
    target_user: User,
    admin_user: User,
) -> User:
    if admin_user.role != "admin":
        raise PermissionDeniedError("Only admins can disable users.")

    if target_user.id == admin_user.id:
        raise PermissionDeniedError("Admins cannot disable their own account.")

    target_user.status = "disabled"
    target_user.updated_at = _utcnow()

    await write_audit_log(
        db=db,
        action="user.disabled",
        user_id=admin_user.id,
        entity_type="user",
        entity_id=target_user.id,
        metadata_json={"target_email": target_user.email},
    )

    await db.commit()
    await db.refresh(target_user)

    return target_user
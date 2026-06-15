import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

ALLOWED_ROLES = {
    "admin",
    "security_engineer",
    "ai_engineer",
    "forward_deployed_engineer",
    "viewer",
}

ALLOWED_STATUSES = {
    "active",
    "inactive",
    "suspended",
}


class EmailValidationMixin(BaseModel):
    @field_validator("email", check_fields=False)
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()

        if not EMAIL_PATTERN.match(normalized):
            raise ValueError("Enter a valid email address.")

        return normalized


class RoleValidationMixin(BaseModel):
    @field_validator("role", check_fields=False)
    @classmethod
    def validate_role(cls, value: str) -> str:
        normalized = value.strip()

        if normalized not in ALLOWED_ROLES:
            raise ValueError(
                "Role must be one of: admin, security_engineer, ai_engineer, forward_deployed_engineer, viewer."
            )

        return normalized


class StatusValidationMixin(BaseModel):
    @field_validator("status", check_fields=False)
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip()

        if normalized not in ALLOWED_STATUSES:
            raise ValueError("Status must be one of: active, inactive, suspended.")

        return normalized


class UserPublic(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    status: str
    organization_name: str | None = None
    email_verified: bool
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class RegisterRequest(EmailValidationMixin):
    full_name: str = Field(..., min_length=2, max_length=160)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    organization_name: str | None = Field(default=None, max_length=180)


class LoginRequest(EmailValidationMixin):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


class AuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserPublic


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=20)


class ForgotPasswordRequest(EmailValidationMixin):
    email: str = Field(..., min_length=5, max_length=255)


class ForgotPasswordResponse(BaseModel):
    message: str


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=20)
    new_password: str = Field(..., min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    organization_name: str | None = Field(default=None, max_length=180)


class AdminUserCreateRequest(EmailValidationMixin, RoleValidationMixin):
    full_name: str = Field(..., min_length=2, max_length=160)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default="ai_engineer", max_length=50)
    organization_name: str | None = Field(default=None, max_length=180)


class AdminUserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    role: str | None = Field(default=None, max_length=50)
    status: str | None = Field(default=None, max_length=30)
    organization_name: str | None = Field(default=None, max_length=180)

    @field_validator("role", check_fields=False)
    @classmethod
    def validate_optional_role(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        if normalized not in ALLOWED_ROLES:
            raise ValueError(
                "Role must be one of: admin, security_engineer, ai_engineer, forward_deployed_engineer, viewer."
            )

        return normalized

    @field_validator("status", check_fields=False)
    @classmethod
    def validate_optional_status(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        if normalized not in ALLOWED_STATUSES:
            raise ValueError("Status must be one of: active, inactive, suspended.")

        return normalized


class UserListResponse(BaseModel):
    total: int
    items: list[UserPublic]


class MessageResponse(BaseModel):
    message: str

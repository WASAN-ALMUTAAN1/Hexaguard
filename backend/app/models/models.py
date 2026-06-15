from app.models.attack_scenario import AttackScenario
from app.models.manual_red_team_run import ManualRedTeamRun
from app.models.campaign import AutomatedCampaign
from app.models.campaign_result import CampaignResult
from app.models.dataset import UploadedDataset
from app.models.dataset_row import DatasetRow

__all__ = [
    "AttackScenario",
    "ManualRedTeamRun",
    "AutomatedCampaign",
    "CampaignResult",
    "UploadedDataset",
    "DatasetRow",
    "ModelRegistry",
]

# Core HexaGuard database models
from app.models.user import User
from app.models.auth_session import AuthSession
from app.models.password_reset_token import PasswordResetToken
from app.models.audit_log import AuditLog


# Model Registry table for HexaGuard model/provider configuration.
# Stored here to avoid creating unnecessary extra model files.
import uuid
from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    model_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(80), nullable=False, default="untested", index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    usage_scope: Mapped[str] = mapped_column(String(80), nullable=False, default="both", index=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    capability_type: Mapped[str] = mapped_column(String(80), nullable=False, default="chat")
    api_key_configured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    masked_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    last_tested_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

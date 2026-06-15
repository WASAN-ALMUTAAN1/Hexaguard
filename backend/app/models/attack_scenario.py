from datetime import datetime

from sqlalchemy import Boolean, DateTime, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AttackScenario(Base):
    __tablename__ = "attack_scenarios"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    scenario_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    attack_name: Mapped[str] = mapped_column(String(255), nullable=False)
    attack_category: Mapped[str] = mapped_column(String(100), index=True, nullable=False)

    prompt_template: Mapped[str] = mapped_column(Text, nullable=False)
    risk_goal: Mapped[str] = mapped_column(Text, nullable=False)
    expected_safe_behavior: Mapped[str] = mapped_column(Text, nullable=False)
    unsafe_behavior: Mapped[str] = mapped_column(Text, nullable=False)

    severity: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    owasp_category: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    mitre_atlas_mapping: Mapped[str | None] = mapped_column(String(255), nullable=True)

    requires_tool: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_rag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    language: Mapped[str] = mapped_column(String(100), default="English", nullable=False)
    mutation_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)

    safe_for_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    dataset_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expected_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    review_status: Mapped[str] = mapped_column(String(50), default="approved", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

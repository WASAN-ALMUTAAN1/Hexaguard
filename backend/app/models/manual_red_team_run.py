from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ManualRedTeamRun(Base):
    __tablename__ = "manual_red_team_runs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    scenario_pk: Mapped[int | None] = mapped_column(
        ForeignKey("attack_scenarios.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    scenario_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    attack_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attack_category: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    severity: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    owasp_category: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    model_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    original_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    edited_prompt: Mapped[str] = mapped_column(Text, nullable=False)

    sandbox_report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    model_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ai_evaluation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    risk_assessment: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    final_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    human_verdict: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    analyst_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

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

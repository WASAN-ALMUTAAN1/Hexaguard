from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CampaignResult(Base):
    __tablename__ = "campaign_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    campaign_pk: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    campaign_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    scenario_pk: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    scenario_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    attack_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attack_category: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    severity: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    owasp_category: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    model_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    mutation_type: Mapped[str] = mapped_column(String(100), default="direct", nullable=False)

    input_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    mutated_prompt: Mapped[str] = mapped_column(Text, nullable=False)

    sandbox_report: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    model_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ai_evaluation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    risk_assessment: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    risk_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    final_status: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

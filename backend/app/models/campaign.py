from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AutomatedCampaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    campaign_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        String(50),
        default="draft",
        nullable=False,
        index=True,
    )

    test_source_type: Mapped[str] = mapped_column(
        String(50),
        default="scenario_library",
        server_default="scenario_library",
        nullable=False,
        index=True,
    )

    dataset_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    dataset_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    dataset_row_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
        nullable=False,
    )

    selected_models: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    selected_scenario_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    selected_categories: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    selected_mutations: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    max_tests: Mapped[int] = mapped_column(
        Integer,
        default=20,
        server_default="20",
        nullable=False,
    )

    total_tests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completed_tests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_tests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    critical_findings: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    average_risk_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

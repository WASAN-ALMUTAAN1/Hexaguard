from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DatasetRow(Base):
    __tablename__ = "dataset_rows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    dataset_pk: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    dataset_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    row_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    prompt: Mapped[str] = mapped_column(Text, nullable=False)

    attack_category: Mapped[str] = mapped_column(
        String(100),
        default="User Dataset",
        nullable=False,
        index=True,
    )

    severity: Mapped[str] = mapped_column(
        String(50),
        default="Medium",
        nullable=False,
        index=True,
    )

    risk_level: Mapped[str] = mapped_column(
        String(50),
        default="Medium",
        server_default="Medium",
        nullable=False,
        index=True,
    )

    subcategory: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    owasp_category: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )

    expected_safe_behavior: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(50), nullable=True)

    tags: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    row_metadata: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

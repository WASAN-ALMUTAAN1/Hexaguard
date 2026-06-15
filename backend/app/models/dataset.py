from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UploadedDataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    dataset_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)

    source_type: Mapped[str] = mapped_column(
        String(50),
        default="local_upload",
        server_default="local_upload",
        nullable=False,
        index=True,
    )

    source_uri: Mapped[str | None] = mapped_column(Text, nullable=True)

    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    validation_status: Mapped[str] = mapped_column(
        String(50),
        default="validated",
        nullable=False,
        index=True,
    )

    validation_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    original_columns: Mapped[list | None] = mapped_column(JSON, nullable=True)
    detected_mapping: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    validation_report: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

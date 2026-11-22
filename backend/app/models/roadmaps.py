from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Identity, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Roadmap(Base):
    __tablename__ = "roadmaps"

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Checkpoint(Base):
    __tablename__ = "checkpoints"
    __table_args__ = (Index("ix_checkpoints_roadmap_id_position", "roadmap_id", "position"),)

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    roadmap_id: Mapped[int] = mapped_column(ForeignKey("roadmaps.id", ondelete="CASCADE"))
    position: Mapped[int]
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    target_date: Mapped[date | None] = mapped_column(Date)
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Identity, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint("end_at IS NULL OR end_at >= start_at", name="ck_events_end_at"),
        CheckConstraint("remind_minutes_before BETWEEN 0 AND 10080", name="ck_events_remind"),
        Index("ix_events_user_id_start_at", "user_id", "start_at"),
    )

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    all_day: Mapped[bool] = mapped_column(server_default="false")
    # Validated by app.services.rrule on every write.
    rrule: Mapped[str | None] = mapped_column(Text)
    remind_minutes_before: Mapped[int | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

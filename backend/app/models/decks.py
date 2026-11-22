from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Deck(Base):
    __tablename__ = "decks"

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Card(Base):
    __tablename__ = "cards"
    __table_args__ = (
        CheckConstraint("stage BETWEEN 0 AND 4", name="ck_cards_stage"),
        Index("ix_cards_deck_id_due_date", "deck_id", "due_date"),
    )

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    deck_id: Mapped[int] = mapped_column(ForeignKey("decks.id", ondelete="CASCADE"))
    front: Mapped[str] = mapped_column(Text)
    back: Mapped[str] = mapped_column(Text)
    # Written only from app.core.srs results.
    stage: Mapped[int] = mapped_column(SmallInteger)
    due_date: Mapped[date | None] = mapped_column(Date)
    review_count: Mapped[int] = mapped_column(server_default="0")
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

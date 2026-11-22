from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, ForeignKeyConstraint, Identity, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class NoteFolder(Base):
    __tablename__ = "note_folders"
    # Composite FK: a parent must belong to the same user, enforced by the DB (not only the router).
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_note_folders_id_user_id"),
        ForeignKeyConstraint(
            ["parent_id", "user_id"],
            ["note_folders.id", "note_folders.user_id"],
            name="fk_note_folders_parent_owner",
            ondelete="CASCADE",
        ),
    )

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[int | None] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class NotePage(Base):
    __tablename__ = "note_pages"
    # Composite FK: the folder must belong to the same user.
    __table_args__ = (
        ForeignKeyConstraint(
            ["folder_id", "user_id"],
            ["note_folders.id", "note_folders.user_id"],
            name="fk_note_pages_folder_owner",
            ondelete="CASCADE",
        ),
    )

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    folder_id: Mapped[int | None] = mapped_column(index=True)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

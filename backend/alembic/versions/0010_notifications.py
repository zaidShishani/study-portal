"""notifications table

Revision ID: 0010
Revises: 0009
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer, sa.Identity(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "event_id", sa.Integer, sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("occurrence_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fire_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint(
            "event_id", "occurrence_start", name="uq_notifications_event_id_occurrence_start"
        ),
    )
    op.create_index(
        "ix_notifications_user_id_read_at_fire_at",
        "notifications",
        ["user_id", "read_at", "fire_at"],
    )


def downgrade() -> None:
    op.drop_table("notifications")

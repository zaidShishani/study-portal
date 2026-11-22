"""events table

Revision ID: 0008
Revises: 0007
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "events",
        sa.Column("id", sa.Integer, sa.Identity(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("all_day", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("rrule", sa.Text, nullable=True),
        sa.Column("remind_minutes_before", sa.Integer, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("end_at IS NULL OR end_at >= start_at", name="ck_events_end_at"),
        sa.CheckConstraint("remind_minutes_before BETWEEN 0 AND 10080", name="ck_events_remind"),
    )
    op.create_index("ix_events_user_id_start_at", "events", ["user_id", "start_at"])


def downgrade() -> None:
    op.drop_table("events")

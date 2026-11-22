"""roadmaps and checkpoints tables

Revision ID: 0007
Revises: 0006
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roadmaps",
        sa.Column("id", sa.Integer, sa.Identity(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_roadmaps_user_id", "roadmaps", ["user_id"])
    op.create_table(
        "checkpoints",
        sa.Column("id", sa.Integer, sa.Identity(), primary_key=True),
        sa.Column(
            "roadmap_id",
            sa.Integer,
            sa.ForeignKey("roadmaps.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("target_date", sa.Date, nullable=True),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_checkpoints_roadmap_id_position", "checkpoints", ["roadmap_id", "position"]
    )


def downgrade() -> None:
    op.drop_table("checkpoints")
    op.drop_table("roadmaps")

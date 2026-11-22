"""cards table

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cards",
        sa.Column("id", sa.Integer, sa.Identity(), primary_key=True),
        sa.Column(
            "deck_id", sa.Integer, sa.ForeignKey("decks.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("front", sa.Text, nullable=False),
        sa.Column("back", sa.Text, nullable=False),
        sa.Column("stage", sa.SmallInteger, nullable=False),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("review_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("stage BETWEEN 0 AND 4", name="ck_cards_stage"),
    )
    op.create_index("ix_cards_deck_id_due_date", "cards", ["deck_id", "due_date"])


def downgrade() -> None:
    op.drop_table("cards")

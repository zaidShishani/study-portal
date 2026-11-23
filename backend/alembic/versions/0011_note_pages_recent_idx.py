"""index note_pages (user_id, updated_at) for recent pages

Revision ID: 0011
Revises: 0010
"""
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_note_pages_user_id_updated_at", "note_pages", ["user_id", "updated_at"])


def downgrade() -> None:
    op.drop_index("ix_note_pages_user_id_updated_at", table_name="note_pages")

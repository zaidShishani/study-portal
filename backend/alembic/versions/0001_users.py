"""users table + seeded user 1

Revision ID: 0001
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    users = op.create_table(
        "users",
        sa.Column("id", sa.Integer, sa.Identity(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="UTC"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    # Fresh table: the identity yields id=1 and advances its sequence, so later inserts get 2+.
    op.bulk_insert(users, [{"email": None}])


def downgrade() -> None:
    op.drop_table("users")

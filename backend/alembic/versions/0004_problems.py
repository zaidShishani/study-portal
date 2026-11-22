"""problems table

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

DIFFICULTY = sa.Enum("Easy", "Medium", "Hard", name="problem_difficulty")
LAST_RESULT = sa.Enum("solved", "solved_with_hint", "failed", name="problem_last_result")
PATTERN = sa.Enum(
    "Two Pointers", "Sliding Window", "Binary Search", "Stack", "Linked List", "Tree", "Trie",
    "Heap", "Graph", "BFS", "DFS", "Backtracking", "DP", "Greedy", "Intervals", "Union Find",
    "Bit Manipulation", "Math",
    name="problem_pattern",
)


def upgrade() -> None:
    op.create_table(  # also creates the enum types
        "problems",
        sa.Column("id", sa.Integer, sa.Identity(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("link", sa.Text, nullable=True),
        sa.Column("difficulty", DIFFICULTY, nullable=False),
        sa.Column("pattern", PATTERN, nullable=False),
        sa.Column("key_insight", sa.Text, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("minutes", sa.SmallInteger, nullable=True),
        sa.Column("last_result", LAST_RESULT, nullable=True),
        sa.Column("solved_date", sa.Date, nullable=True),
        sa.Column("review_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("stage", sa.SmallInteger, nullable=False),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("retired_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("stage BETWEEN 0 AND 4", name="ck_problems_stage"),
    )
    op.create_index("ix_problems_user_id_due_date", "problems", ["user_id", "due_date"])


def downgrade() -> None:
    op.drop_table("problems")
    for enum in (DIFFICULTY, LAST_RESULT, PATTERN):
        enum.drop(op.get_bind())

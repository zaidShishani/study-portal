"""note folder/page links must stay within one user (composite FKs)

Revision ID: 0008
Revises: 0007
"""
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("uq_note_folders_id_user_id", "note_folders", ["id", "user_id"])
    op.drop_constraint("note_folders_parent_id_fkey", "note_folders", type_="foreignkey")
    op.create_foreign_key(
        "fk_note_folders_parent_owner",
        "note_folders",
        "note_folders",
        ["parent_id", "user_id"],
        ["id", "user_id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("note_pages_folder_id_fkey", "note_pages", type_="foreignkey")
    op.create_foreign_key(
        "fk_note_pages_folder_owner",
        "note_pages",
        "note_folders",
        ["folder_id", "user_id"],
        ["id", "user_id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_note_pages_folder_owner", "note_pages", type_="foreignkey")
    op.create_foreign_key(
        "note_pages_folder_id_fkey", "note_pages", "note_folders", ["folder_id"], ["id"], ondelete="CASCADE"
    )
    op.drop_constraint("fk_note_folders_parent_owner", "note_folders", type_="foreignkey")
    op.create_foreign_key(
        "note_folders_parent_id_fkey", "note_folders", "note_folders", ["parent_id"], ["id"], ondelete="CASCADE"
    )
    op.drop_constraint("uq_note_folders_id_user_id", "note_folders", type_="unique")

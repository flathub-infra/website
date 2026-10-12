"""add moderation discussions

Revision ID: 9b62e320c0f8
Revises: 231b4b09957a
Create Date: 2026-10-11 18:45:18.274976

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9b62e320c0f8'
down_revision = '231b4b09957a'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "moderationrequest", sa.Column("discussion_url", sa.String(), nullable=True)
    )
    op.add_column(
        "moderationrequest",
        sa.Column("discussion_comment", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_column("moderationrequest", "discussion_comment")
    op.drop_column("moderationrequest", "discussion_url")

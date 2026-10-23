"""add moderation internal comment

Revision ID: ce2fee2e8d91
Revises: 9b53f4fbc132
Create Date: 2026-10-23 18:24:31.194921

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ce2fee2e8d91'
down_revision = '9b53f4fbc132'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "moderationrequest", sa.Column("internal_comment", sa.String(), nullable=True)
    )


def downgrade():
    op.drop_column("moderationrequest", "internal_comment")

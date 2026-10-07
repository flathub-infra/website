"""Add app refs to moderation requests

Revision ID: 2d6e0a8b719c
Revises: 123b6483fbe5
Create Date: 2026-10-08 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "2d6e0a8b719c"
down_revision = "123b6483fbe5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "moderationrequest",
        sa.Column("app_refs", postgresql.ARRAY(sa.String()), nullable=True),
    )


def downgrade():
    op.drop_column("moderationrequest", "app_refs")

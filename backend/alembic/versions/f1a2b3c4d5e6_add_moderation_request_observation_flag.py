"""add moderation request observation flag

Revision ID: f1a2b3c4d5e6
Revises: 0debacaff89f
Create Date: 2026-08-11 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

revision = "f1a2b3c4d5e6"
down_revision = "0debacaff89f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "moderationrequest",
        sa.Column(
            "is_observation",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column("moderationrequest", "is_observation")

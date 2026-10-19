"""Cache read-only Anitya maintenance evidence.

Revision ID: a19f47d032ef
Revises: 36d604cf352d
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a19f47d032ef"
down_revision = "36d604cf352d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "maintenanceupstream",
        sa.Column(
            "app_id",
            sa.String(),
            sa.ForeignKey("apps.app_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("upstream_version", sa.String(), nullable=True),
        sa.Column(
            "stable_versions", postgresql.JSONB(), nullable=False, server_default="[]"
        ),
        sa.Column("source_url", sa.String(), nullable=True),
        sa.Column("checked_at", sa.DateTime(), nullable=True),
        sa.Column("last_attempt_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
    )


def downgrade():
    op.drop_table("maintenanceupstream")

"""Add daily permission statistics snapshots.

Revision ID: c4f98a1d73b2
Revises: 4cacdf50defe
Create Date: 2026-09-27
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "c4f98a1d73b2"
down_revision = "4cacdf50defe"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "permission_stats_snapshots",
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("eligible_apps", sa.Integer(), nullable=False),
        sa.Column("apps_with_stable_metadata", sa.Integer(), nullable=False),
        sa.Column(
            "permission_counts",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("snapshot_date"),
    )


def downgrade():
    op.drop_table("permission_stats_snapshots")

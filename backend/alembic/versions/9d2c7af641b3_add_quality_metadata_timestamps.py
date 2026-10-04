"""Add per-category quality metadata timestamps

Revision ID: 9d2c7af641b3
Revises: c4f98a1d73b2
Create Date: 2026-10-05 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "9d2c7af641b3"
down_revision = "c4f98a1d73b2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "apps",
        sa.Column(
            "quality_metadata_updated_at",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("apps", "quality_metadata_updated_at")

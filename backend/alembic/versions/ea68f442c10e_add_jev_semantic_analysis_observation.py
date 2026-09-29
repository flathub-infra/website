"""Add Jev semantic analysis observation

Revision ID: ea68f442c10e
Revises: d7e31aa7bb2b
Create Date: 2026-09-29 08:16:39.559441

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'ea68f442c10e'
down_revision = 'd7e31aa7bb2b'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "manifestanalysisobservation",
        sa.Column(
            "jev_semantic_analysis",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("manifestanalysisobservation", "jev_semantic_analysis")

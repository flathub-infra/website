"""Drop Jev semantic analysis observation

Revision ID: 4cacdf50defe
Revises: b1857a727fd3
Create Date: 2026-10-04 10:18:08.979766

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '4cacdf50defe'
down_revision = 'b1857a727fd3'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("manifestanalysisobservation", "jev_semantic_analysis")


def downgrade():
    op.add_column(
        "manifestanalysisobservation",
        sa.Column(
            "jev_semantic_analysis",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )

"""Add curated selection layout

Revision ID: 7c2e4a6b8d10
Revises: 518a0e462ba8
Create Date: 2026-08-15 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "7c2e4a6b8d10"
down_revision = "518a0e462ba8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "scheduledselection",
        sa.Column("layout", sa.String(), server_default="grid", nullable=False),
    )
    op.create_check_constraint(
        "scheduledselection_layout",
        "scheduledselection",
        "layout IN ('grid', 'carousel')",
    )


def downgrade():
    op.drop_constraint(
        "scheduledselection_layout", "scheduledselection", type_="check"
    )
    op.drop_column("scheduledselection", "layout")

"""add app stats distro installs

Revision ID: 2656ab9792e1
Revises: 00ab42ba9c5e
Create Date: 2026-11-04 17:57:12.224134

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2656ab9792e1"
down_revision = "00ab42ba9c5e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "app_stats",
        sa.Column(
            "installs_per_distro",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "app_stats",
        sa.Column(
            "installs_unreported_distro",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column("app_stats", "installs_unreported_distro")
    op.drop_column("app_stats", "installs_per_distro")

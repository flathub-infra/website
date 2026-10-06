"""add display name overridden flag

Revision ID: 123b6483fbe5
Revises: 764270f4c2ea
Create Date: 2026-10-06 10:12:55.615474

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '123b6483fbe5'
down_revision = '764270f4c2ea'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "flathubuser",
        sa.Column(
            "display_name_overridden",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade():
    op.drop_column("flathubuser", "display_name_overridden")

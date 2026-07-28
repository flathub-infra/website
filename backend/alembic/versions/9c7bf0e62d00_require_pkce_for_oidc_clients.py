"""require PKCE for OIDC clients

Revision ID: 9c7bf0e62d00
Revises: a966029e592b
Create Date: 2026-07-28 14:35:18.695235

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9c7bf0e62d00'
down_revision = 'a966029e592b'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "oidcclient",
        sa.Column(
            "require_pkce",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column("oidcclient", "require_pkce")

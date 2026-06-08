"""add updated_at to runtimescope

Revision ID: c682b53eb353
Revises: db98543a156d
Create Date: 2026-06-08 10:41:59.103582

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "c682b53eb353"
down_revision = "db98543a156d"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "runtimescope",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column("runtimescope", "updated_at")

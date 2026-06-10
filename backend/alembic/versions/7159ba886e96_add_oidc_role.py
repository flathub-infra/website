"""add oidc role

Revision ID: 7159ba886e96
Revises: 977697280a29
Create Date: 2026-06-10 20:51:46.510232

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7159ba886e96'
down_revision = '977697280a29'
branch_labels = None
depends_on = None


def upgrade():
    op.bulk_insert(
        sa.table(
            "role",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(), nullable=False, unique=True),
        ),
        [
            {"id": 5, "name": "oidc"},
        ],
    )


def downgrade():
    op.execute(
        sa.text(
            "DELETE FROM flathubuser_role WHERE role_id = "
            "(SELECT id FROM role WHERE name = 'oidc')"
        )
    )
    op.execute(sa.text("DELETE FROM role WHERE name = 'oidc'"))

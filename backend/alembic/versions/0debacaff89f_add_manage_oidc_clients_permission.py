"""add manage oidc clients permission

Revision ID: 0debacaff89f
Revises: afc4e8972918
Create Date: 2026-07-28 21:48:04.322524

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0debacaff89f'
down_revision = 'afc4e8972918'
branch_labels = None
depends_on = None


def upgrade():
    op.bulk_insert(
        sa.table(
            "permission",
            sa.Column("name", sa.String(), nullable=False, unique=True),
        ),
        [{"name": "manage-oidc-clients"}],
    )
    op.bulk_insert(
        sa.table(
            "role_permission",
            sa.Column("role_id", sa.Integer(), nullable=False),
            sa.Column("permission_name", sa.String(), nullable=False),
        ),
        [{"role_id": 1, "permission_name": "manage-oidc-clients"}],
    )


def downgrade():
    op.execute(
        "DELETE FROM role_permission WHERE permission_name = 'manage-oidc-clients'"
    )
    op.execute("DELETE FROM permission WHERE name = 'manage-oidc-clients'")

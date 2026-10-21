"""remove view-users from moderator role

Revision ID: 4c8e1f9a2b73
Revises: 00a2a7d6296e
Create Date: 2026-10-21 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "4c8e1f9a2b73"
down_revision = "00a2a7d6296e"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        sa.text(
            "DELETE FROM role_permission "
            "WHERE permission_name = 'view-users' "
            "AND role_id = (SELECT id FROM role WHERE name = 'moderator')"
        )
    )


def downgrade():
    op.execute(
        sa.text(
            "INSERT INTO role_permission (role_id, permission_name) "
            "SELECT id, 'view-users' FROM role WHERE name = 'moderator' "
            "ON CONFLICT DO NOTHING"
        )
    )

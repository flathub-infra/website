"""Add new user permissions

Revision ID: 82cc97da0e54
Revises: b94c4046195e
Create Date: 2025-01-08 09:11:35.559663

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "82cc97da0e54"
down_revision = "b94c4046195e"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.bulk_insert(
        sa.table(
            "permission",
            sa.Column("name", sa.String(), nullable=False, unique=True),
        ),
        [
            {"name": "view-users"},
            {"name": "modify-users"},
        ],
    )

    op.bulk_insert(
        sa.table(
            "role_permission",
            sa.Column("role_id", sa.Integer(), nullable=False),
            sa.Column("permission_name", sa.String(), nullable=False),
        ),
        [
            {"role_id": 1, "permission_name": "view-users"},
            {"role_id": 2, "permission_name": "view-users"},
            {"role_id": 1, "permission_name": "modify-users"},
        ],
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###

    op.execute(
        "DELETE FROM role_permission WHERE permission_name IN ('view-users', 'modify-users')"
    )
    op.execute("DELETE FROM permission WHERE name IN ('view-users', 'modify-users')")

    # ### end Alembic commands ###
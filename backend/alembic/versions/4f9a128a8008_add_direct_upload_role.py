"""add direct-upload role

Revision ID: 4f9a128a8008
Revises: 5c6c6459f661
Create Date: 2024-04-16 12:12:17.638727

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "4f9a128a8008"
down_revision = "5c6c6459f661"
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
            {"id": 4, "name": "uploader"},
        ],
    )
    op.bulk_insert(
        sa.table(
            "role_permission",
            sa.Column("role_id", sa.Integer(), nullable=False),
            sa.Column("permission_name", sa.String(), nullable=False),
        ),
        [
            {"role_id": 4, "permission_name": "direct-upload"},
        ],
    )


def downgrade():
    pass

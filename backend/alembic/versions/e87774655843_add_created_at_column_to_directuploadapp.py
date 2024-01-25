"""add created_at column to directuploadapp

Revision ID: e87774655843
Revises: f62cbfbf4e20
Create Date: 2024-01-25 10:56:27.499520

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e87774655843'
down_revision = 'f62cbfbf4e20'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("directuploadapp", sa.Column("created_at", sa.DateTime, server_default="now()", nullable=True))
    op.add_column("directuploadapp", sa.Column("first_seen_at", sa.DateTime, default=None, nullable=True))


def downgrade():
    op.drop_column("directuploadapp", "created_at")
    op.drop_column("directuploadapp", "first_seen_at")

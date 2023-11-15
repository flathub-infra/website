"""Merge migrations

Revision ID: 66b535348e74
Revises: 4467f5d6002d, fgbceb410b8d
Create Date: 2023-11-15 15:21:19.466284

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '66b535348e74'
down_revision = ('4467f5d6002d', 'fgbceb410b8d')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass

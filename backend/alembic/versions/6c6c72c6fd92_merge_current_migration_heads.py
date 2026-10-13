"""Merge current migration heads

Revision ID: 6c6c72c6fd92
Revises: 8d9b00c70619, 9a973800fb57
Create Date: 2026-10-08 10:24:59.426603

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6c6c72c6fd92'
down_revision = ('8d9b00c70619', '9a973800fb57')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass

"""Merge wallet and verified app model branches

Revision ID: 7589e5e508b9
Revises: 253ab628caf8, 9e19eeef7ab4
Create Date: 2022-03-17 09:23:07.465045

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7589e5e508b9'
down_revision = ('253ab628caf8', '9e19eeef7ab4')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass

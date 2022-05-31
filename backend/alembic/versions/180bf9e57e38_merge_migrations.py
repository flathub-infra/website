"""Merge migrations

Revision ID: 180bf9e57e38
Revises: 6750f9fd90fa, e56739493e1e
Create Date: 2022-05-31 13:14:56.194620

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '180bf9e57e38'
down_revision = ('6750f9fd90fa', 'e56739493e1e')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass

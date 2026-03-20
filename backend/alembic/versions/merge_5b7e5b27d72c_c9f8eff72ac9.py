"""merge migrations

Revision ID: a2b3c4d5e6f7
Revises: 5b7e5b27d72c, c9f8eff72ac9
Create Date: 2026-03-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a2b3c4d5e6f7'
down_revision = ('5b7e5b27d72c', 'c9f8eff72ac9')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass

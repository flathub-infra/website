"""merge migrations

Revision ID: c9f8eff72ac9
Revises: 20d5caee3984, 850fec56d92a
Create Date: 2025-11-21 00:02:18.486933

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c9f8eff72ac9'
down_revision = ('20d5caee3984', '850fec56d92a')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass

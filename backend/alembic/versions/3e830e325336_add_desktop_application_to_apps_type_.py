"""add desktop-application to apps type enum

Revision ID: 3e830e325336
Revises: 87db4e14adea
Create Date: 2024-09-11 19:47:06.503620

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3e830e325336'
down_revision = '87db4e14adea'
branch_labels = None
depends_on = None

old_type = sa.Enum('desktop', 'localization', 'console-application', 'generic', 'runtime', 'addon', name='app_type')
new_type = sa.Enum('desktop', 'localization', 'console-application', 'generic', 'runtime', 'addon', 'desktop-application', name='app_type')

def upgrade():
    op.execute("ALTER TYPE app_type ADD VALUE 'desktop-application'")

def downgrade():
    op.execute("ALTER TYPE app_type DROP VALUE 'desktop-application'")

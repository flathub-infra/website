"""add_main_category_and_sub_categories_to_apps

Revision ID: a1b2c3d4e5f6
Revises: 20d5caee3984
Create Date: 2025-12-05 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '20d5caee3984'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add main_category column (single category string)
    op.add_column('apps', sa.Column('main_category', sa.String(), nullable=True))
    # Add sub_categories column (array of strings)
    op.add_column('apps', sa.Column('sub_categories', ARRAY(sa.String()), nullable=True))

    # Create index on main_category for fast category filtering
    op.create_index('apps_main_category_idx', 'apps', ['main_category'])
    # Create GIN index on sub_categories for efficient array queries
    op.create_index('apps_sub_categories_idx', 'apps', ['sub_categories'], postgresql_using='gin')


def downgrade() -> None:
    op.drop_index('apps_sub_categories_idx', table_name='apps')
    op.drop_index('apps_main_category_idx', table_name='apps')
    op.drop_column('apps', 'sub_categories')
    op.drop_column('apps', 'main_category')

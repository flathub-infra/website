"""add eol_branches column to app model

Revision ID: 5db3ed6373fc
Revises: 13fec21e27e1
Create Date: 2025-02-27 11:41:57.552343

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5db3ed6373fc'
down_revision = '13fec21e27e1'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('apps', sa.Column('eol_branches', sa.dialects.postgresql.JSONB(), nullable=True))


def downgrade():
    op.drop_column('apps', 'eol_branches')

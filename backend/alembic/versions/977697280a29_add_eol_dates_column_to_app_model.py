"""add eol_dates column to app model

Revision ID: 977697280a29
Revises: c682b53eb353
Create Date: 2026-06-09 11:35:55.326891

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '977697280a29'
down_revision = 'c682b53eb353'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('apps', sa.Column('eol_dates', sa.dialects.postgresql.JSONB(), nullable=True))


def downgrade():
    op.drop_column('apps', 'eol_dates')

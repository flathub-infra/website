"""add_summary_and_appstream_jsonb_columns

Revision ID: 71d60844180b
Revises: d7e1d2130fdb
Create Date: 2025-02-07 23:54:12.326725

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = '71d60844180b'
down_revision = 'd7e1d2130fdb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('apps', sa.Column('summary', JSONB, nullable=True))
    op.add_column('apps', sa.Column('appstream', JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('apps', 'appstream')
    op.drop_column('apps', 'summary')

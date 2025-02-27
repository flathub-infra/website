"""create exceptions table

Revision ID: 13fec21e27e1
Revises: ae8fa1b4f651
Create Date: 2025-02-26 23:23:39.405526

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = '13fec21e27e1'
down_revision = 'ae8fa1b4f651'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'exceptions',
        sa.Column('app_id', sa.String(), nullable=False),
        sa.Column('value', JSONB, nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('app_id')
    )


def downgrade():
    op.drop_table('exceptions')

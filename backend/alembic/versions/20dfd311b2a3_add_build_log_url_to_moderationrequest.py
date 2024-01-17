"""add build_log_url to ModerationRequest

Revision ID: 20dfd311b2a3
Revises: fb0b29dfa4c3
Create Date: 2024-01-17 14:08:02.110698

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20dfd311b2a3'
down_revision = 'fb0b29dfa4c3'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("moderationrequest", sa.Column("build_log_url", sa.String(), nullable=True))
    op.execute("UPDATE moderationrequest SET build_log_url=false")
    op.alter_column("moderationrequest", "build_log_url", nullable=False)

def downgrade():
    op.drop_column("moderationrequest", "build_log_url")

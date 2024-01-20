"""add archived column to directuploadapp

Revision ID: f62cbfbf4e20
Revises: 20dfd311b2a3
Create Date: 2024-01-20 09:28:56.552143

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f62cbfbf4e20'
down_revision = '20dfd311b2a3'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("directuploadapp", sa.Column("archived", sa.Boolean(), default=False, nullable=True))
    op.execute("UPDATE directuploadapp SET archived=FALSE")
    op.alter_column("directuploadapp", "archived", nullable=False)


def downgrade():
    op.drop_column("directuploadapp", "archived")

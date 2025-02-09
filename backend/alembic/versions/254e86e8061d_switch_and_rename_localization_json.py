"""switch_and_rename_localization_json

Revision ID: 254e86e8061d
Revises: 71d60844180b
Create Date: 2025-02-09 21:06:08.301861

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = '254e86e8061d'
down_revision = '71d60844180b'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('apps', 'localization_json',
                    new_column_name='localization',
                    type_=JSONB,
                    existing_type=sa.JSON,
                    nullable=True)


def downgrade():
    op.alter_column('apps', 'localization',
                    new_column_name='localization_json',
                    type_=sa.JSON,
                    existing_type=JSONB,
                    nullable=True)

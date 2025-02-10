"""switch_and_rename_localization_json

Revision ID: ae8fa1b4f651
Revises: e02f32f2a8c4
Create Date: 2025-02-10 11:12:48.237769

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = 'ae8fa1b4f651'
down_revision = 'e02f32f2a8c4'
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

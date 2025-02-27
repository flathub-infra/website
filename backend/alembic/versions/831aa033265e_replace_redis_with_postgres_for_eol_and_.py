"""replace redis with postgres for eol and extension lookup

Revision ID: 831aa033265e
Revises: ffe020a2c0dd
Create Date: 2025-02-27 14:22:01.392696

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '831aa033265e'
down_revision = 'ffe020a2c0dd'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('apps', sa.Column('eol_message', sa.String(), nullable=True))
    
    op.create_table('app_eol_rebase',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('app_id', sa.String(), nullable=False),
        sa.Column('old_app_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_app_eol_rebase_app_id'), 'app_eol_rebase', ['app_id'], unique=True)
    
    op.create_table('app_extension_lookup',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('extension_id', sa.String(), nullable=False),
        sa.Column('parent_app_id', sa.String(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_app_extension_lookup_extension_id'), 'app_extension_lookup', ['extension_id'], unique=True)
    op.create_index(op.f('ix_app_extension_lookup_parent_app_id'), 'app_extension_lookup', ['parent_app_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_app_extension_lookup_parent_app_id'), table_name='app_extension_lookup')
    op.drop_index(op.f('ix_app_extension_lookup_extension_id'), table_name='app_extension_lookup')
    op.drop_table('app_extension_lookup')
    
    op.drop_index(op.f('ix_app_eol_rebase_app_id'), table_name='app_eol_rebase')
    op.drop_table('app_eol_rebase')
    
    op.drop_column('apps', 'eol_message')

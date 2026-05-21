"""oidc refresh token foundation

Revision ID: c1d2e3f4a5b6
Revises: b0c5f3d9e1a2
Create Date: 2026-06-01 12:00:00.000000

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = 'c1d2e3f4a5b6'
down_revision = 'b0c5f3d9e1a2'
branch_labels = None
depends_on = None


def upgrade():
    # Add refresh_tokens_enabled column to oidcclient
    op.add_column(
        'oidcclient',
        sa.Column('refresh_tokens_enabled', sa.Boolean(), server_default=sa.false(), nullable=False),
    )

    # Add refresh_token_family_id column to oidcaccesstoken
    op.add_column(
        'oidcaccesstoken',
        sa.Column('refresh_token_family_id', sa.String(), nullable=True),
    )
    op.create_index(
        op.f('ix_oidcaccesstoken_refresh_token_family_id'),
        'oidcaccesstoken',
        ['refresh_token_family_id'],
        unique=False,
    )

    # Create oidcrefreshtoken table
    op.create_table(
        'oidcrefreshtoken',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('refresh_token_hash', sa.String(), nullable=False),
        sa.Column('family_id', sa.String(), nullable=False),
        sa.Column('scope', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('rotated_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('replaced_by_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['oidcclient.client_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['flathubuser.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['replaced_by_id'], ['oidcrefreshtoken.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_oidcrefreshtoken_client_id'), 'oidcrefreshtoken', ['client_id'], unique=False)
    op.create_index(op.f('ix_oidcrefreshtoken_user_id'), 'oidcrefreshtoken', ['user_id'], unique=False)
    op.create_index(
        op.f('ix_oidcrefreshtoken_refresh_token_hash'), 'oidcrefreshtoken', ['refresh_token_hash'], unique=True
    )
    op.create_index(op.f('ix_oidcrefreshtoken_family_id'), 'oidcrefreshtoken', ['family_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_oidcrefreshtoken_family_id'), table_name='oidcrefreshtoken')
    op.drop_index(op.f('ix_oidcrefreshtoken_refresh_token_hash'), table_name='oidcrefreshtoken')
    op.drop_index(op.f('ix_oidcrefreshtoken_user_id'), table_name='oidcrefreshtoken')
    op.drop_index(op.f('ix_oidcrefreshtoken_client_id'), table_name='oidcrefreshtoken')
    op.drop_table('oidcrefreshtoken')
    op.drop_index(op.f('ix_oidcaccesstoken_refresh_token_family_id'), table_name='oidcaccesstoken')
    op.drop_column('oidcaccesstoken', 'refresh_token_family_id')
    op.drop_column('oidcclient', 'refresh_tokens_enabled')

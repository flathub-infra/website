"""oidc data foundation

Revision ID: b0c5f3d9e1a2
Revises: a2b3c4d5e6f7
Create Date: 2026-05-20 22:12:32.340238

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'b0c5f3d9e1a2'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('flathubuser', sa.Column('oidc_subject', sa.String(), nullable=True))
    op.create_index(op.f('ix_flathubuser_oidc_subject'), 'flathubuser', ['oidc_subject'], unique=True)
    op.create_table('oidcclient',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.String(), nullable=False),
    sa.Column('client_secret_hash', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('redirect_uris', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('allowed_scopes', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('enabled', sa.Boolean(), server_default=sa.true(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_oidcclient_client_id'), 'oidcclient', ['client_id'], unique=True)
    op.create_table('oidcauthorizationcode',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.String(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('code_hash', sa.String(), nullable=False),
    sa.Column('redirect_uri', sa.String(), nullable=False),
    sa.Column('scope', sa.String(), nullable=False),
    sa.Column('nonce', sa.String(), nullable=True),
    sa.Column('code_challenge', sa.String(), nullable=True),
    sa.Column('code_challenge_method', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('consumed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['client_id'], ['oidcclient.client_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['flathubuser.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_oidcauthorizationcode_client_id'), 'oidcauthorizationcode', ['client_id'], unique=False)
    op.create_index(op.f('ix_oidcauthorizationcode_code_hash'), 'oidcauthorizationcode', ['code_hash'], unique=True)
    op.create_index(op.f('ix_oidcauthorizationcode_user_id'), 'oidcauthorizationcode', ['user_id'], unique=False)
    op.create_table('oidcaccesstoken',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('client_id', sa.String(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('access_token_hash', sa.String(), nullable=False),
    sa.Column('scope', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('revoked_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['client_id'], ['oidcclient.client_id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['flathubuser.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_oidcaccesstoken_access_token_hash'), 'oidcaccesstoken', ['access_token_hash'], unique=True)
    op.create_index(op.f('ix_oidcaccesstoken_client_id'), 'oidcaccesstoken', ['client_id'], unique=False)
    op.create_index(op.f('ix_oidcaccesstoken_user_id'), 'oidcaccesstoken', ['user_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_oidcaccesstoken_user_id'), table_name='oidcaccesstoken')
    op.drop_index(op.f('ix_oidcaccesstoken_client_id'), table_name='oidcaccesstoken')
    op.drop_index(op.f('ix_oidcaccesstoken_access_token_hash'), table_name='oidcaccesstoken')
    op.drop_table('oidcaccesstoken')
    op.drop_index(op.f('ix_oidcauthorizationcode_user_id'), table_name='oidcauthorizationcode')
    op.drop_index(op.f('ix_oidcauthorizationcode_code_hash'), table_name='oidcauthorizationcode')
    op.drop_index(op.f('ix_oidcauthorizationcode_client_id'), table_name='oidcauthorizationcode')
    op.drop_table('oidcauthorizationcode')
    op.drop_index(op.f('ix_oidcclient_client_id'), table_name='oidcclient')
    op.drop_table('oidcclient')
    op.drop_index(op.f('ix_flathubuser_oidc_subject'), table_name='flathubuser')
    op.drop_column('flathubuser', 'oidc_subject')

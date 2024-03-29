"""direct_upload_app

Revision ID: 22cb6643c6f7
Revises: 1a9d5e4a1719
Create Date: 2023-07-05 15:59:27.989823

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '22cb6643c6f7'
down_revision = '1a9d5e4a1719'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('directuploadapp',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('app_id', sa.String(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_directuploadapp_app_id'), 'directuploadapp', ['app_id'], unique=True)
    op.create_table('directuploadappdeveloper',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('app_id', sa.Integer(), nullable=False),
    sa.Column('developer_id', sa.Integer(), nullable=False),
    sa.Column('is_primary', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['app_id'], ['directuploadapp.id'], ),
    sa.ForeignKeyConstraint(['developer_id'], ['flathubuser.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('direct_upload_app_developer_unique', 'directuploadappdeveloper', ['app_id', 'developer_id'], unique=True)
    op.create_index('direct_upload_app_only_one_primary', 'directuploadappdeveloper', ['app_id'], unique=True, postgresql_where=sa.text('is_primary'))
    op.create_index(op.f('ix_directuploadappdeveloper_app_id'), 'directuploadappdeveloper', ['app_id'], unique=False)
    op.create_index(op.f('ix_directuploadappdeveloper_developer_id'), 'directuploadappdeveloper', ['developer_id'], unique=False)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_directuploadappdeveloper_developer_id'), table_name='directuploadappdeveloper')
    op.drop_index(op.f('ix_directuploadappdeveloper_app_id'), table_name='directuploadappdeveloper')
    op.drop_index('direct_upload_app_only_one_primary', table_name='directuploadappdeveloper', postgresql_where=sa.text('is_primary'))
    op.drop_index('direct_upload_app_developer_unique', table_name='directuploadappdeveloper')
    op.drop_table('directuploadappdeveloper')
    op.drop_index(op.f('ix_directuploadapp_app_id'), table_name='directuploadapp')
    op.drop_table('directuploadapp')
    # ### end Alembic commands ###

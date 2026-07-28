"""track OIDC authorization replays

Revision ID: a966029e592b
Revises: 41f5ea3c6aca
Create Date: 2026-07-28 14:10:23.504962

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a966029e592b'
down_revision = '41f5ea3c6aca'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "oidcauthorizationcode",
        sa.Column("replayed_at", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "oidcaccesstoken",
        sa.Column("authorization_code_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_oidcaccesstoken_authorization_code_id",
        "oidcaccesstoken",
        "oidcauthorizationcode",
        ["authorization_code_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_oidcaccesstoken_authorization_code_id"),
        "oidcaccesstoken",
        ["authorization_code_id"],
        unique=False,
    )

    op.add_column(
        "oidcrefreshtoken",
        sa.Column("authorization_code_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_oidcrefreshtoken_authorization_code_id",
        "oidcrefreshtoken",
        "oidcauthorizationcode",
        ["authorization_code_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_oidcrefreshtoken_authorization_code_id"),
        "oidcrefreshtoken",
        ["authorization_code_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_oidcrefreshtoken_authorization_code_id"),
        table_name="oidcrefreshtoken",
    )
    op.drop_constraint(
        "fk_oidcrefreshtoken_authorization_code_id",
        "oidcrefreshtoken",
        type_="foreignkey",
    )
    op.drop_column("oidcrefreshtoken", "authorization_code_id")

    op.drop_index(
        op.f("ix_oidcaccesstoken_authorization_code_id"),
        table_name="oidcaccesstoken",
    )
    op.drop_constraint(
        "fk_oidcaccesstoken_authorization_code_id",
        "oidcaccesstoken",
        type_="foreignkey",
    )
    op.drop_column("oidcaccesstoken", "authorization_code_id")
    op.drop_column("oidcauthorizationcode", "replayed_at")

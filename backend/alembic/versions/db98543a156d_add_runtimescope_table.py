"""add runtimescope table

Revision ID: db98543a156d
Revises: c1d2e3f4a5b6
Create Date: 2026-06-07 11:16:53.753580

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "db98543a156d"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "runtimescope",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("app_id", sa.String(), nullable=False),
        sa.Column("prefixes", sa.String(), nullable=False),
        sa.Column("extra_ids", sa.String(), server_default="", nullable=False),
        sa.Column("repos", sa.String(), server_default="stable beta", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_runtimescope_app_id"),
        "runtimescope",
        ["app_id"],
        unique=True,
    )


def downgrade():
    op.drop_index(op.f("ix_runtimescope_app_id"), table_name="runtimescope")
    op.drop_table("runtimescope")

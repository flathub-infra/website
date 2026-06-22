"""add auditlog table

Revision ID: d327db764c77
Revises: 7159ba886e96
Create Date: 2026-06-22 00:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

# revision identifiers, used by Alembic.
revision = "d327db764c77"
down_revision = "7159ba886e96"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "auditlog",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("target_user_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("details", JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["flathubuser.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["target_user_id"], ["flathubuser.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_auditlog_user_id"), "auditlog", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_auditlog_target_user_id"),
        "auditlog",
        ["target_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_auditlog_event_type"), "auditlog", ["event_type"], unique=False
    )
    op.create_index(
        op.f("ix_auditlog_created_at"), "auditlog", ["created_at"], unique=False
    )
    op.create_index(
        "ix_auditlog_user_created",
        "auditlog",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_auditlog_target_created",
        "auditlog",
        ["target_user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_auditlog_event_created",
        "auditlog",
        ["event_type", "created_at"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_auditlog_event_created", table_name="auditlog")
    op.drop_index("ix_auditlog_target_created", table_name="auditlog")
    op.drop_index("ix_auditlog_user_created", table_name="auditlog")
    op.drop_index(op.f("ix_auditlog_created_at"), table_name="auditlog")
    op.drop_index(op.f("ix_auditlog_event_type"), table_name="auditlog")
    op.drop_index(op.f("ix_auditlog_target_user_id"), table_name="auditlog")
    op.drop_index(op.f("ix_auditlog_user_id"), table_name="auditlog")
    op.drop_table("auditlog")

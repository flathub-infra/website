"""Add summary decision

Revision ID: 231b4b09957a
Revises: e0573a1c1bcd
Create Date: 2026-10-09 15:51:05.649518

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '231b4b09957a'
down_revision = 'e0573a1c1bcd'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "summarydecision",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("app_id", sa.String(), nullable=False),
        sa.Column("build_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("old_summary", sa.String(), nullable=False),
        sa.Column("new_summary", sa.String(), nullable=False),
        sa.Column("model", sa.String(), nullable=False),
        sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("approved", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_summarydecision_app_id"), "summarydecision", ["app_id"]
    )
    op.create_index(
        op.f("ix_summarydecision_approved"), "summarydecision", ["approved"]
    )


def downgrade():
    op.drop_index(op.f("ix_summarydecision_approved"), table_name="summarydecision")
    op.drop_index(op.f("ix_summarydecision_app_id"), table_name="summarydecision")
    op.drop_table("summarydecision")

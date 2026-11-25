"""Drop permission triage

Revision ID: e5a818c5eecc
Revises: 3b7d9e1c5a42
Create Date: 2026-11-25 14:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "e5a818c5eecc"
down_revision = "3b7d9e1c5a42"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table("permissiontriage")


def downgrade():
    op.create_table(
        "permissiontriage",
        sa.Column(
            "assessment_id",
            sa.Integer(),
            sa.ForeignKey("permissionassessmentobservation.id"),
            primary_key=True,
            autoincrement=False,
        ),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("result", postgresql.JSONB()),
        sa.Column("error", sa.String()),
        sa.Column("model", sa.String()),
        sa.Column("prompt_version", sa.String()),
        sa.Column("input_tokens", sa.Integer()),
        sa.Column("output_tokens", sa.Integer()),
        sa.Column("tool_calls", postgresql.JSONB()),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("claimable_at", sa.DateTime()),
        sa.Column("duration_seconds", sa.Float()),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("completed_at", sa.DateTime()),
        sa.CheckConstraint(
            "status IN ('pending', 'completed', 'failed', 'skipped')",
            name="permissiontriage_status",
        ),
    )

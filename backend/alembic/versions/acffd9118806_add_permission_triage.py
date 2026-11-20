"""add permission triage

Revision ID: acffd9118806
Revises: 7ca910f76d42
Create Date: 2026-11-20 12:34:17.958970

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "acffd9118806"
down_revision = "7ca910f76d42"
branch_labels = None
depends_on = None


def upgrade():
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


def downgrade():
    op.drop_table("permissiontriage")

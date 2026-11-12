"""Persist checker selection artifacts independently of source health.

Revision ID: 91d3a62f804b
Revises: 7e4c92a1b630
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "91d3a62f804b"
down_revision = "7e4c92a1b630"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "checkerhealthartifact", sa.Column("shard_index", sa.Integer(), nullable=True)
    )
    op.create_table(
        "checkerselectionartifact",
        sa.Column(
            "artifact_id", sa.BigInteger(), primary_key=True, autoincrement=False
        ),
        sa.Column("run_id", sa.BigInteger(), nullable=False),
        sa.Column("run_attempt", sa.Integer(), nullable=False),
        sa.Column("shard_index", sa.Integer(), nullable=False),
        sa.Column("state", sa.String(), nullable=False),
        sa.Column("run_completed", sa.Boolean(), nullable=False),
        sa.Column("inventory", postgresql.JSONB()),
        sa.Column("listing", postgresql.JSONB()),
        sa.Column("decisions", postgresql.JSONB()),
    )
    op.create_index(
        "ix_checkerselectionartifact_run_id", "checkerselectionartifact", ["run_id"]
    )


def downgrade():
    op.drop_table("checkerselectionartifact")
    op.drop_column("checkerhealthartifact", "shard_index")

"""Add checker health observations.

Revision ID: ab6e923cf014
Revises: 00ab42ba9c5e
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "ab6e923cf014"
down_revision = "00ab42ba9c5e"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "checkerhealthartifact",
        sa.Column(
            "artifact_id", sa.BigInteger(), primary_key=True, autoincrement=False
        ),
        sa.Column("run_id", sa.BigInteger(), nullable=False),
        sa.Column("run_attempt", sa.Integer(), nullable=False),
        sa.Column(
            "imported_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index(
        "ix_checkerhealthartifact_run_attempt",
        "checkerhealthartifact",
        ["run_id", "run_attempt"],
        unique=True,
    )
    op.create_table(
        "checkerhealthobservation",
        sa.Column(
            "artifact_id",
            sa.BigInteger(),
            sa.ForeignKey("checkerhealthartifact.artifact_id"),
            primary_key=True,
        ),
        sa.Column("app_id", sa.String(), primary_key=True),
        sa.Column("run_id", sa.BigInteger(), nullable=False),
        sa.Column("run_attempt", sa.Integer(), nullable=False),
        sa.Column("observed_at", sa.DateTime(), nullable=False),
        sa.Column("report", postgresql.JSONB(), nullable=False),
    )
    op.create_index(
        "ix_checkerhealthobservation_app_id", "checkerhealthobservation", ["app_id"]
    )


def downgrade():
    op.drop_table("checkerhealthobservation")
    op.drop_table("checkerhealthartifact")

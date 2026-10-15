"""Add shared maintenance triage.

Revision ID: ba6f029c184e
Revises: f054f69fc4bf
"""

from alembic import op
import sqlalchemy as sa

revision = "ba6f029c184e"
down_revision = "f054f69fc4bf"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "maintenancetriage",
        sa.Column(
            "app_id",
            sa.String(),
            sa.ForeignKey("apps.app_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "owner_id",
            sa.Integer(),
            sa.ForeignKey("flathubuser.id", ondelete="SET NULL"),
        ),
        sa.Column("notes", sa.String(), nullable=False, server_default=""),
        sa.Column("snoozed_until", sa.DateTime()),
        sa.Column("snooze_reason", sa.String(), nullable=False, server_default=""),
        sa.Column("fingerprint", sa.String(), nullable=False, server_default=""),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_by",
            sa.Integer(),
            sa.ForeignKey("flathubuser.id", ondelete="SET NULL"),
        ),
    )


def downgrade():
    op.drop_table("maintenancetriage")

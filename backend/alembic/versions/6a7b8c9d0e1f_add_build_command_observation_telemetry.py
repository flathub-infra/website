from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "6a7b8c9d0e1f"
down_revision = "7c2e4a6b8d10"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "manifestanalysisobservation",
        sa.Column(
            "build_command_event_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "manifestanalysisobservation",
        sa.Column(
            "build_command_distinct_fingerprint_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "manifestanalysisobservation",
        sa.Column(
            "build_command_fingerprint_group_sizes",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.alter_column(
        "manifestanalysisobservation",
        "build_command_event_count",
        server_default=None,
    )
    op.alter_column(
        "manifestanalysisobservation",
        "build_command_distinct_fingerprint_count",
        server_default=None,
    )
    op.alter_column(
        "manifestanalysisobservation",
        "build_command_fingerprint_group_sizes",
        server_default=None,
    )


def downgrade():
    op.drop_column(
        "manifestanalysisobservation", "build_command_fingerprint_group_sizes"
    )
    op.drop_column(
        "manifestanalysisobservation", "build_command_distinct_fingerprint_count"
    )
    op.drop_column("manifestanalysisobservation", "build_command_event_count")

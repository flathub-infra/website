"""drop manifest complexity observation columns

Revision ID: 4542b636b040
Revises: b230fe2f57d8
Create Date: 2026-10-20 07:08:18.526811

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "4542b636b040"
down_revision = "b230fe2f57d8"
branch_labels = None
depends_on = None

TABLE = "manifestanalysisobservation"
COLUMNS = (
    ("complexity_status", sa.String()),
    ("complexity_algorithm_version", sa.Integer()),
    ("complexity_threshold_units", sa.Integer()),
    ("complexity_score_units", sa.Integer()),
    ("complexity_raw_score_units", sa.Integer()),
    ("complexity_score_band", sa.String()),
    ("complexity_not_scored_reason", sa.String()),
    ("complexity_analysis_fingerprint", sa.String()),
    ("complexity_would_gate", sa.Boolean()),
    ("complexity_data", postgresql.JSONB(astext_type=sa.Text())),
    ("build_command_event_count", sa.Integer()),
    ("build_command_distinct_fingerprint_count", sa.Integer()),
    ("build_command_fingerprint_group_sizes", postgresql.JSONB(astext_type=sa.Text())),
    ("complexity_gating_enabled", sa.Boolean()),
    ("complexity_observe_only", sa.Boolean()),
)


def upgrade():
    for name, _ in COLUMNS:
        op.drop_column(TABLE, name)


def downgrade():
    for name, column_type in COLUMNS:
        op.add_column(TABLE, sa.Column(name, column_type, nullable=True))

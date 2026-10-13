import sqlalchemy as sa
from alembic import op

revision = "9a973800fb57"
down_revision = "9ae51e3262ac"
branch_labels = None
depends_on = None

TABLE = "permissionassessmentobservation"
OUTCOME = "permissionassessmentobservation_outcome_consistency"


def _outcome_constraint(outcomes: str) -> None:
    op.drop_constraint(OUTCOME, TABLE, type_="check")
    op.create_check_constraint(
        OUTCOME,
        TABLE,
        f"(outcome IN ({outcomes}) AND candidate_snapshot IS NOT NULL "
        "AND fingerprint IS NOT NULL AND error_code IS NULL "
        "AND error_message IS NULL) OR "
        "(outcome = 'error' AND fingerprint IS NULL "
        "AND error_code IS NOT NULL AND error_message IS NOT NULL)",
    )


def upgrade():
    op.add_column(TABLE, sa.Column("acceptance_basis", sa.String(), nullable=True))
    op.add_column(TABLE, sa.Column("baseline_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "permissionassessmentobservation_baseline_id_fkey",
        TABLE,
        "permissionbaseline",
        ["baseline_id"],
        ["id"],
    )
    _outcome_constraint("'pending', 'accepted'")
    op.create_check_constraint(
        "permissionassessmentobservation_acceptance",
        TABLE,
        "(outcome = 'accepted' AND acceptance_basis IS NOT NULL "
        "AND acceptance_basis = 'baseline' AND differences IS NOT NULL "
        "AND baseline_id IS NOT NULL AND differences = '[]'::jsonb) OR "
        "(outcome <> 'accepted' AND acceptance_basis IS NULL)",
    )


def downgrade():
    op.drop_constraint(
        "permissionassessmentobservation_acceptance", TABLE, type_="check"
    )
    _outcome_constraint("'pending'")
    op.drop_constraint(
        "permissionassessmentobservation_baseline_id_fkey", TABLE, type_="foreignkey"
    )
    op.drop_column(TABLE, "baseline_id")
    op.drop_column(TABLE, "acceptance_basis")

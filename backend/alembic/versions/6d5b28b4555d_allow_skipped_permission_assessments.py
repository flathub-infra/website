from alembic import op

revision = "6d5b28b4555d"
down_revision = "4542b636b040"
branch_labels = None
depends_on = None

TABLE = "permissionassessmentobservation"
OUTCOME = f"{TABLE}_outcome_consistency"


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
    _outcome_constraint("'pending', 'accepted', 'rejected', 'skipped'")


def downgrade():
    op.execute(
        f"UPDATE {TABLE} SET outcome = 'pending', decision_id = NULL "
        "WHERE outcome = 'skipped'"
    )
    op.execute("DELETE FROM permissiondecision WHERE decision = 'skipped'")
    _outcome_constraint("'pending', 'accepted', 'rejected'")

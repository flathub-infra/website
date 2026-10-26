from alembic import op

revision = "49cc2e861a9e"
down_revision = "06daf8a2ecb8"
branch_labels = None
depends_on = None

TABLE = "permissionassessmentobservation"
OUTCOME = f"{TABLE}_outcome_consistency"


def upgrade():
    op.drop_constraint(OUTCOME, TABLE, type_="check")
    op.create_check_constraint(
        OUTCOME,
        TABLE,
        "(outcome IN ('pending', 'accepted', 'rejected', 'snoozed', 'ignored') "
        "AND candidate_snapshot IS NOT NULL "
        "AND fingerprint IS NOT NULL AND error_code IS NULL "
        "AND error_message IS NULL) OR "
        "(outcome = 'error' AND fingerprint IS NULL "
        "AND error_code IS NOT NULL AND error_message IS NOT NULL)",
    )


def downgrade():
    op.drop_constraint(OUTCOME, TABLE, type_="check")
    op.execute(f"UPDATE {TABLE} SET outcome = 'snoozed' WHERE outcome = 'ignored'")
    op.execute(
        "UPDATE permissiondecision SET decision = 'snoozed' WHERE decision = 'ignored'"
    )
    op.create_check_constraint(
        OUTCOME,
        TABLE,
        "(outcome IN ('pending', 'accepted', 'rejected', 'snoozed') "
        "AND candidate_snapshot IS NOT NULL "
        "AND fingerprint IS NOT NULL AND error_code IS NULL "
        "AND error_message IS NULL) OR "
        "(outcome = 'error' AND fingerprint IS NULL "
        "AND error_code IS NOT NULL AND error_message IS NOT NULL)",
    )

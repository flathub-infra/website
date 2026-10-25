"""rename skipped permission decisions to snoozed

Revision ID: 06daf8a2ecb8
Revises: ce2fee2e8d91
Create Date: 2026-10-25 20:07:29.476750

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "06daf8a2ecb8"
down_revision = "ce2fee2e8d91"
branch_labels = None
depends_on = None

TABLE = "permissionassessmentobservation"
OUTCOME = f"{TABLE}_outcome_consistency"


def _rename(old: str, new: str) -> None:
    op.drop_constraint(OUTCOME, TABLE, type_="check")
    op.execute(f"UPDATE {TABLE} SET outcome = '{new}' WHERE outcome = '{old}'")
    op.execute(
        f"UPDATE permissiondecision SET decision = '{new}' WHERE decision = '{old}'"
    )
    op.create_check_constraint(
        OUTCOME,
        TABLE,
        f"(outcome IN ('pending', 'accepted', 'rejected', '{new}') "
        "AND candidate_snapshot IS NOT NULL "
        "AND fingerprint IS NOT NULL AND error_code IS NULL "
        "AND error_message IS NULL) OR "
        "(outcome = 'error' AND fingerprint IS NULL "
        "AND error_code IS NOT NULL AND error_message IS NOT NULL)",
    )


def upgrade():
    _rename("skipped", "snoozed")


def downgrade():
    _rename("snoozed", "skipped")

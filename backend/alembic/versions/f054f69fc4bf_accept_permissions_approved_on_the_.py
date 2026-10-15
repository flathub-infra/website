"""Accept permissions approved on the other channel

Revision ID: f054f69fc4bf
Revises: 2d6e0a8b719c
Create Date: 2026-10-15 13:08:06.547404

"""

from alembic import op

revision = "f054f69fc4bf"
down_revision = "2d6e0a8b719c"
branch_labels = None
depends_on = None

OBSERVATION = "permissionassessmentobservation"
ACCEPTANCE = f"{OBSERVATION}_acceptance"


def _acceptance(other_bases: str) -> None:
    op.drop_constraint(ACCEPTANCE, OBSERVATION, type_="check")
    op.create_check_constraint(
        ACCEPTANCE,
        OBSERVATION,
        "(outcome = 'accepted' AND acceptance_basis IS NOT NULL "
        "AND ((acceptance_basis = 'baseline' AND baseline_id IS NOT NULL "
        "AND differences IS NOT NULL AND differences = '[]'::jsonb) "
        f"OR acceptance_basis IN ({other_bases}))) OR "
        "(outcome <> 'accepted' AND acceptance_basis IS NULL)",
    )


def upgrade():
    _acceptance("'permission_decision', 'stable_baseline', 'beta_approval'")


def downgrade():
    op.execute(
        f"UPDATE {OBSERVATION} SET outcome = 'pending', acceptance_basis = NULL "
        "WHERE acceptance_basis IN ('stable_baseline', 'beta_approval')"
    )
    _acceptance("'permission_decision'")

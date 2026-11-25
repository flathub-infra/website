"""Accept missing permission baselines

Revision ID: 3b7d9e1c5a42
Revises: 18cc6e5235d9
Create Date: 2026-11-25 12:00:00.000000

"""

from alembic import op

revision = "3b7d9e1c5a42"
down_revision = "18cc6e5235d9"
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
    _acceptance(
        "'permission_decision', 'stable_baseline', 'beta_approval', 'missing_baseline'"
    )


def downgrade():
    op.execute(
        f"UPDATE {OBSERVATION} SET outcome = 'pending', acceptance_basis = NULL "
        "WHERE acceptance_basis = 'missing_baseline'"
    )
    _acceptance("'permission_decision', 'stable_baseline', 'beta_approval'")

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c5e8a2d71f94"
down_revision = "9b62e320c0f8"
branch_labels = None
depends_on = None

OBSERVATION = "permissionassessmentobservation"
OUTCOME = f"{OBSERVATION}_outcome_consistency"
ACCEPTANCE = f"{OBSERVATION}_acceptance"
DECISION_FK = "pao_decision_fkey"
BASELINE_SOURCE = "permissionbaseline_source"


def _constraints(outcomes: str, acceptance_basis: str, baseline_sources: str) -> None:
    op.drop_constraint(OUTCOME, OBSERVATION, type_="check")
    op.create_check_constraint(
        OUTCOME,
        OBSERVATION,
        f"(outcome IN ({outcomes}) AND candidate_snapshot IS NOT NULL "
        "AND fingerprint IS NOT NULL AND error_code IS NULL "
        "AND error_message IS NULL) OR "
        "(outcome = 'error' AND fingerprint IS NULL "
        "AND error_code IS NOT NULL AND error_message IS NOT NULL)",
    )
    op.drop_constraint(ACCEPTANCE, OBSERVATION, type_="check")
    op.create_check_constraint(
        ACCEPTANCE,
        OBSERVATION,
        f"(outcome = 'accepted' AND acceptance_basis IS NOT NULL "
        f"AND {acceptance_basis}) OR "
        "(outcome <> 'accepted' AND acceptance_basis IS NULL)",
    )
    op.drop_constraint(BASELINE_SOURCE, "permissionbaseline", type_="check")
    op.create_check_constraint(
        BASELINE_SOURCE, "permissionbaseline", f"source IN ({baseline_sources})"
    )


BASELINE_BASIS = (
    "acceptance_basis = 'baseline' AND differences IS NOT NULL "
    "AND baseline_id IS NOT NULL AND differences = '[]'::jsonb"
)


def upgrade():
    op.add_column(
        OBSERVATION,
        sa.Column(
            "linter_reports",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.create_table(
        "permissiondecision",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("reviewer_id", sa.Integer(), nullable=False),
        sa.Column("decision", sa.String(), nullable=False),
        sa.Column("rationale", sa.String()),
        sa.ForeignKeyConstraint(["assessment_id"], [f"{OBSERVATION}.id"]),
        sa.ForeignKeyConstraint(["reviewer_id"], ["flathubuser.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column(OBSERVATION, sa.Column("decision_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        DECISION_FK, OBSERVATION, "permissiondecision", ["decision_id"], ["id"]
    )
    op.create_index(
        "ix_pao_pr",
        OBSERVATION,
        ["forge_instance", "source_repository", "pull_request_number"],
    )
    _constraints(
        "'pending', 'accepted', 'rejected'",
        f"(({BASELINE_BASIS}) OR acceptance_basis = 'permission_decision')",
        "'initialized', 'approved'",
    )


def downgrade():
    _constraints("'pending', 'accepted'", BASELINE_BASIS, "'initialized'")
    op.drop_index("ix_pao_pr", table_name=OBSERVATION)
    op.drop_constraint(DECISION_FK, OBSERVATION, type_="foreignkey")
    op.drop_column(OBSERVATION, "decision_id")
    op.drop_table("permissiondecision")
    op.drop_column(OBSERVATION, "linter_reports")

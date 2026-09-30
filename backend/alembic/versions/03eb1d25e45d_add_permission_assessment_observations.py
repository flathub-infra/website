from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "03eb1d25e45d"
down_revision = "ea68f442c10e"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "permissionassessmentobservation",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("assessment_identity", sa.String(), nullable=False),
        sa.Column("outcome", sa.String(), nullable=False),
        sa.Column("app_id", sa.String(), nullable=False),
        sa.Column("pipeline_id", sa.String(), nullable=False),
        sa.Column("forge_instance", sa.String(), nullable=False),
        sa.Column("source_repository", sa.String(), nullable=False),
        sa.Column("pull_request_head_revision", sa.String(), nullable=False),
        sa.Column("built_revision", sa.String(), nullable=False),
        sa.Column("target_git_branch", sa.String(), nullable=False),
        sa.Column("base_revision", sa.String(), nullable=False),
        sa.Column("candidate_kind", sa.String(), nullable=False),
        sa.Column("intended_repo", sa.String(), nullable=False),
        sa.Column("intended_channel", sa.String(), nullable=False),
        sa.Column("flatpak_branch", sa.String(), nullable=False),
        sa.Column("build_id", sa.Integer(), nullable=False),
        sa.Column("pull_request_number", sa.Integer(), nullable=True),
        sa.Column("pull_request_url", sa.String(), nullable=True),
        sa.Column(
            "expected_arches", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "canonicalization_version",
            sa.Integer(),
            server_default=sa.text("2"),
            nullable=False,
        ),
        sa.Column(
            "candidate_artifacts",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "published_artifacts",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "uploaded_refs", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "candidate_snapshot",
            postgresql.JSONB(none_as_null=True, astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "published_snapshot",
            postgresql.JSONB(none_as_null=True, astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "differences",
            postgresql.JSONB(none_as_null=True, astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("fingerprint", sa.String(), nullable=True),
        sa.Column("published_fingerprint", sa.String(), nullable=True),
        sa.Column("error_code", sa.String(), nullable=True),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.CheckConstraint(
            "(outcome = 'pending' AND candidate_snapshot IS NOT NULL AND fingerprint IS NOT NULL AND error_code IS NULL AND error_message IS NULL) OR (outcome = 'error' AND fingerprint IS NULL AND error_code IS NOT NULL AND error_message IS NOT NULL)",
            name="permissionassessmentobservation_outcome_consistency",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(expected_arches) = 'array' AND expected_arches <> '[]'::jsonb AND jsonb_typeof(candidate_artifacts) = 'array' AND jsonb_typeof(published_artifacts) = 'array' AND jsonb_typeof(uploaded_refs) = 'array'",
            name="permissionassessmentobservation_json_arrays",
        ),
        sa.CheckConstraint(
            "(pull_request_number IS NULL AND pull_request_url IS NULL) OR (pull_request_number IS NOT NULL AND pull_request_url IS NOT NULL)",
            name="permissionassessmentobservation_pr_pair",
        ),
        sa.CheckConstraint(
            "(candidate_snapshot IS NOT NULL AND fingerprint IS NOT NULL AND published_snapshot IS NOT NULL AND published_fingerprint IS NOT NULL AND differences IS NOT NULL) OR (published_snapshot IS NULL AND published_fingerprint IS NULL AND differences IS NULL)",
            name="permissionassessmentobservation_published_comparison",
        ),
        sa.CheckConstraint(
            "canonicalization_version = 2",
            name="permissionassessmentobservation_canonicalization_version",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_permissionassessmentobservation_app_id_created_at",
        "permissionassessmentobservation",
        ["app_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_permissionassessmentobservation_created_at",
        "permissionassessmentobservation",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "permissionassessmentobservation_assessment_identity_unique",
        "permissionassessmentobservation",
        ["assessment_identity"],
        unique=True,
    )


def downgrade():
    op.drop_index(
        "permissionassessmentobservation_assessment_identity_unique",
        table_name="permissionassessmentobservation",
    )
    op.drop_index(
        "ix_permissionassessmentobservation_created_at",
        table_name="permissionassessmentobservation",
    )
    op.drop_index(
        "ix_permissionassessmentobservation_app_id_created_at",
        table_name="permissionassessmentobservation",
    )
    op.drop_table("permissionassessmentobservation")

import sqlalchemy as sa
from alembic import op

revision = "145992160c2c"
down_revision = "17c152546d5a"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "permissionassessmentobservation",
        "pull_request_head_revision",
        existing_type=sa.String(),
        nullable=True,
    )
    op.add_column(
        "permissionassessmentobservation",
        sa.Column("linked_assessment_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "permissionassessmentobservation",
        sa.Column("linked_fingerprint_match", sa.Boolean(), nullable=True),
    )
    op.create_foreign_key(
        "permissionassessmentobservation_linked_assessment_id_fkey",
        "permissionassessmentobservation",
        "permissionassessmentobservation",
        ["linked_assessment_id"],
        ["id"],
    )
    op.create_check_constraint(
        "permissionassessmentobservation_linked_match",
        "permissionassessmentobservation",
        "linked_assessment_id IS NOT NULL OR linked_fingerprint_match IS NULL",
    )


def downgrade():
    op.drop_constraint(
        "permissionassessmentobservation_linked_match",
        "permissionassessmentobservation",
        type_="check",
    )
    op.drop_constraint(
        "permissionassessmentobservation_linked_assessment_id_fkey",
        "permissionassessmentobservation",
        type_="foreignkey",
    )
    op.drop_column("permissionassessmentobservation", "linked_fingerprint_match")
    op.drop_column("permissionassessmentobservation", "linked_assessment_id")
    op.alter_column(
        "permissionassessmentobservation",
        "pull_request_head_revision",
        existing_type=sa.String(),
        nullable=False,
    )

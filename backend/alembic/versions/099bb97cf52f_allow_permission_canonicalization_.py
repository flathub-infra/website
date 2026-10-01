from alembic import op
import sqlalchemy as sa

revision = "099bb97cf52f"
down_revision = "03eb1d25e45d"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint(
        "permissionassessmentobservation_canonicalization_version",
        "permissionassessmentobservation",
        type_="check",
    )
    op.create_check_constraint(
        "permissionassessmentobservation_canonicalization_version",
        "permissionassessmentobservation",
        "canonicalization_version IN (2, 3)",
    )
    op.alter_column(
        "permissionassessmentobservation",
        "canonicalization_version",
        server_default=sa.text("3"),
    )


def downgrade():
    op.alter_column(
        "permissionassessmentobservation",
        "canonicalization_version",
        server_default=sa.text("2"),
    )
    op.drop_constraint(
        "permissionassessmentobservation_canonicalization_version",
        "permissionassessmentobservation",
        type_="check",
    )
    op.create_check_constraint(
        "permissionassessmentobservation_canonicalization_version",
        "permissionassessmentobservation",
        "canonicalization_version = 2",
    )

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "17c152546d5a"
down_revision = "099bb97cf52f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "permissionassessmentobservation",
        sa.Column(
            "build_checks",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column("permissionassessmentobservation", "build_checks")

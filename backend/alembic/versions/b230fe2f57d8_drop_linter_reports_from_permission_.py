import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "b230fe2f57d8"
down_revision = "a19f47d032ef"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("permissionassessmentobservation", "linter_reports")


def downgrade():
    op.add_column(
        "permissionassessmentobservation",
        sa.Column(
            "linter_reports",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )

"""automate summary quality guidelines

Revision ID: d31d10a0182b
Revises: b664044af9f3
Create Date: 2026-04-15 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d31d10a0182b"
down_revision = "b664044af9f3"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        sa.text(
            "UPDATE guideline SET read_only = true"
            " WHERE id IN ('app-summary-dont-start-with-an-article',"
            "              'app-summary-dont-repeat-app-name')"
        )
    )


def downgrade():
    op.execute(
        sa.text(
            "UPDATE guideline SET read_only = false"
            " WHERE id IN ('app-summary-dont-start-with-an-article',"
            "              'app-summary-dont-repeat-app-name')"
        )
    )

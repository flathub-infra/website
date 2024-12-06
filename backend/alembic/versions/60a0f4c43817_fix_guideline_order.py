"""Fix guideline order

Revision ID: 60a0f4c43817
Revises: 833167a72fbf
Create Date: 2024-12-06 21:41:33.265126

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "60a0f4c43817"
down_revision = "833167a72fbf"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "UPDATE guideline SET \"order\" = 0 WHERE id = 'general-no-trademark-violations'"
    )


def downgrade():
    op.execute(
        "UPDATE guideline SET \"order\" = 1 WHERE id = 'general-no-trademark-violations'"
    )

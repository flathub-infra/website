"""Pin the recipe target of queued add-on translations."""

import sqlalchemy as sa

from alembic import op

revision = "18cc6e5235d9"
down_revision = "923dcb518ee1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("metadatatranslationbatch", sa.Column("recipe_target", sa.JSON()))


def downgrade():
    op.drop_column("metadatatranslationbatch", "recipe_target")

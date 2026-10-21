import sqlalchemy as sa
from alembic import op

revision = "00a2a7d6296e"
down_revision = "6d5b28b4555d"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "permissionbaseline", sa.Column("runtime", sa.String(), nullable=True)
    )


def downgrade():
    op.drop_column("permissionbaseline", "runtime")

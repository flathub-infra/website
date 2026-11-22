"""Record checkout submissions independently of Stripe webhook deliveries."""

import sqlalchemy as sa
from alembic import op

revision = "2391df57c86a"
down_revision = "d5064a8eb13c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "stripetransaction",
        sa.Column(
            "checkout_revision", sa.Integer(), nullable=False, server_default="0"
        ),
    )


def downgrade():
    op.drop_column("stripetransaction", "checkout_revision")

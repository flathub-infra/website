"""Record the outcome of translation listing checks."""

import sqlalchemy as sa
from alembic import op

revision = "d18b529f34bc"
down_revision = "e5a818c5eecc"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "translationlistingcheck",
        sa.Column(
            "app_id",
            sa.String(),
            sa.ForeignKey("apps.app_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("outcome", sa.String(), nullable=False),
        sa.Column("checked_at", sa.DateTime(), nullable=False),
        sa.Column("http_status", sa.Integer()),
        sa.Column("ambiguous_locales", sa.JSON()),
    )


def downgrade():
    op.drop_table("translationlistingcheck")

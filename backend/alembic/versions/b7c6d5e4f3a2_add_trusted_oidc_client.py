import sqlalchemy as sa

from alembic import op

revision = "b7c6d5e4f3a2"
down_revision = "6a7b8c9d0e1f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "oidcclient",
        sa.Column(
            "trusted",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )


def downgrade():
    op.drop_column("oidcclient", "trusted")

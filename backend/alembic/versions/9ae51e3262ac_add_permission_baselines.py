import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "9ae51e3262ac"
down_revision = "4cacdf50defe"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "permissionbaseline",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("app_id", sa.String(), nullable=False),
        sa.Column("channel", sa.String(), nullable=False),
        sa.Column("flatpak_branch", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("repository_url", sa.String(), nullable=False),
        sa.Column("captured_at", sa.DateTime(), nullable=False),
        sa.Column("canonicalization_version", sa.Integer(), nullable=False),
        sa.Column("artifacts", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("fingerprint", sa.String(), nullable=False),
        sa.CheckConstraint(
            "source = 'initialized'",
            name="permissionbaseline_source",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(artifacts) = 'array' AND artifacts <> '[]'::jsonb",
            name="permissionbaseline_artifacts",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "permissionbaseline_scope_unique",
        "permissionbaseline",
        ["app_id", "channel", "flatpak_branch"],
        unique=True,
    )


def downgrade():
    op.drop_index("permissionbaseline_scope_unique", table_name="permissionbaseline")
    op.drop_table("permissionbaseline")

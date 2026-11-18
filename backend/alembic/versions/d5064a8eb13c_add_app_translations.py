"""Add shared metadata translation batches and the listing index.

Revision ID: d5064a8eb13c
Revises: 6d5b320ac749
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "d5064a8eb13c"
down_revision = "6d5b320ac749"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "metadatatranslationbatch",
        sa.Column("app_id", sa.String(255), primary_key=True),
        sa.Column("locale", sa.String(40), primary_key=True),
        sa.Column("revision", sa.String(40), nullable=False),
        sa.Column("source_sha", sa.String(40), nullable=False),
        sa.Column("path", sa.String(), nullable=False),
        sa.Column("source_content", sa.LargeBinary()),
        sa.Column("content", sa.LargeBinary()),
        sa.Column("missing_texts", sa.Integer()),
        sa.Column("next_review_check", sa.DateTime()),
        sa.Column("publishing_since", sa.DateTime()),
        sa.Column(
            "publication_attempt",
            postgresql.JSONB(),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("generation", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "publication_base", postgresql.JSONB(), nullable=False, server_default="{}"
        ),
        sa.Column(
            "field_edits", postgresql.JSONB(), nullable=False, server_default="{}"
        ),
        sa.Column(
            "published_ids", postgresql.JSONB(), nullable=False, server_default="[]"
        ),
        sa.Column("changes", postgresql.JSONB(), nullable=False),
        sa.Column(
            "previous_translations",
            postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("error", sa.String(), nullable=True),
        sa.Column("url", sa.String(), nullable=True),
    )
    op.create_table(
        "translationlisting",
        sa.Column(
            "app_id",
            sa.String(),
            sa.ForeignKey("apps.app_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("checked_at", sa.DateTime(), nullable=False),
        sa.Column("sha", sa.String(40)),
        sa.Column("missing", postgresql.JSONB(none_as_null=True)),
    )


def downgrade():
    op.drop_table("translationlisting")
    op.drop_table("metadatatranslationbatch")

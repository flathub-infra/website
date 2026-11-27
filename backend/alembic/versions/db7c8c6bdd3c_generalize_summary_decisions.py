"""Generalize summary decisions

Revision ID: db7c8c6bdd3c
Revises: d18b529f34bc
Create Date: 2026-11-27 10:17:27.452845

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "db7c8c6bdd3c"
down_revision = "d18b529f34bc"
branch_labels = None
depends_on = None


def upgrade():
    op.rename_table("summarydecision", "appdatadecision")
    op.execute("ALTER SEQUENCE summarydecision_id_seq RENAME TO appdatadecision_id_seq")
    op.execute("ALTER INDEX summarydecision_pkey RENAME TO appdatadecision_pkey")
    op.execute(
        "ALTER INDEX ix_summarydecision_app_id RENAME TO ix_appdatadecision_app_id"
    )
    op.execute(
        "ALTER INDEX ix_summarydecision_approved RENAME TO ix_appdatadecision_approved"
    )
    op.alter_column("appdatadecision", "old_summary", new_column_name="old_value")
    op.alter_column("appdatadecision", "new_summary", new_column_name="new_value")
    op.add_column(
        "appdatadecision",
        sa.Column("field", sa.String(), nullable=False, server_default="summary"),
    )
    op.alter_column("appdatadecision", "field", server_default=None)


def downgrade():
    op.execute("DELETE FROM appdatadecision WHERE field != 'summary'")
    op.drop_column("appdatadecision", "field")
    op.alter_column("appdatadecision", "new_value", new_column_name="new_summary")
    op.alter_column("appdatadecision", "old_value", new_column_name="old_summary")
    op.execute(
        "ALTER INDEX ix_appdatadecision_approved RENAME TO ix_summarydecision_approved"
    )
    op.execute(
        "ALTER INDEX ix_appdatadecision_app_id RENAME TO ix_summarydecision_app_id"
    )
    op.execute("ALTER INDEX appdatadecision_pkey RENAME TO summarydecision_pkey")
    op.execute("ALTER SEQUENCE appdatadecision_id_seq RENAME TO summarydecision_id_seq")
    op.rename_table("appdatadecision", "summarydecision")

"""Add core listing counts without discarding the existing queue counts.

Revision ID: 7bbc44db5503
Revises: 2391df57c86a
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "7bbc44db5503"
down_revision = "2391df57c86a"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "translationlisting",
        sa.Column("missing_listing", postgresql.JSONB(none_as_null=True)),
    )
    op.add_column("translationlisting", sa.Column("indexed_at", sa.DateTime()))
    op.add_column("translationlisting", sa.Column("index_write_id", sa.String(32)))
    op.add_column(
        "metadatatranslationbatch", sa.Column("missing_listing_texts", sa.Integer())
    )
    op.add_column(
        "metadatatranslationbatch",
        sa.Column(
            "listing_count_failed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "metadatatranslationbatch", sa.Column("listing_count_write_id", sa.String(32))
    )
    # A legacy ORM write may update only some fields. Once the new indexer has
    # written a complete result, it owns the row until this migration is reverted.
    # Before handoff, fence both legacy results and indistinguishable retries.
    op.execute("""
        CREATE FUNCTION track_legacy_translation_listing_result() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                IF NEW.index_write_id IS NULL THEN
                    NEW.indexed_at := NEW.checked_at;
                END IF;
            ELSIF NEW.index_write_id IS NOT DISTINCT FROM OLD.index_write_id THEN
                IF OLD.missing_listing IS NOT NULL OR NEW.checked_at < OLD.indexed_at THEN
                    RETURN OLD;
                END IF;
                NEW.indexed_at := NEW.checked_at;
                NEW.checked_at := greatest(OLD.checked_at, NEW.checked_at);
            END IF;
            RETURN NEW;
        END;
        $$
        """)
    op.execute("""
        CREATE TRIGGER track_legacy_translation_listing_result
        BEFORE INSERT OR UPDATE ON translationlisting
        FOR EACH ROW EXECUTE FUNCTION track_legacy_translation_listing_result()
        """)
    op.execute("""
        CREATE FUNCTION invalidate_translation_batch_listing_count() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.listing_count_write_id IS NOT DISTINCT FROM OLD.listing_count_write_id
                AND ROW(NEW.content, NEW.source_sha, NEW.missing_texts) IS DISTINCT FROM
                    ROW(OLD.content, OLD.source_sha, OLD.missing_texts)
            THEN
                NEW.missing_listing_texts := NULL;
                NEW.listing_count_failed := false;
            END IF;
            RETURN NEW;
        END;
        $$
        """)
    op.execute("""
        CREATE TRIGGER invalidate_translation_batch_listing_count
        BEFORE UPDATE OF content, source_sha, missing_texts ON metadatatranslationbatch
        FOR EACH ROW
        WHEN (OLD.missing_listing_texts IS NOT NULL OR OLD.listing_count_failed)
        EXECUTE FUNCTION invalidate_translation_batch_listing_count()
        """)


def downgrade():
    op.execute(
        "DROP TRIGGER track_legacy_translation_listing_result ON translationlisting"
    )
    op.execute("DROP FUNCTION track_legacy_translation_listing_result()")
    op.execute(
        "DROP TRIGGER invalidate_translation_batch_listing_count ON metadatatranslationbatch"
    )
    op.execute("DROP FUNCTION invalidate_translation_batch_listing_count()")
    op.drop_column("metadatatranslationbatch", "listing_count_write_id")
    op.drop_column("metadatatranslationbatch", "listing_count_failed")
    op.drop_column("metadatatranslationbatch", "missing_listing_texts")
    op.drop_column("translationlisting", "index_write_id")
    op.drop_column("translationlisting", "indexed_at")
    op.drop_column("translationlisting", "missing_listing")

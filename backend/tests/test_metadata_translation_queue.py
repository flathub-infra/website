import os
from contextlib import contextmanager, nullcontext
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from github import GithubException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import metadata_translation_batches as batches
from app import metadata_translation_queue as queue
from app.metadata_translation_queue import missing_counts


def test_only_core_listing_fields_count_towards_queue():
    app_id = "org.example.App"
    xml = b"""<component><id>org.example.App</id><metadata_license>CC0</metadata_license>
    <name>Example</name><name xml:lang="fr">Exemple</name>
    <name_variant_suffix>Preview</name_variant_suffix><developer><name>Studio</name></developer>
    <summary>Hello</summary><summary xml:lang="de">Hallo</summary>
    <description><p>Open</p><p xml:lang="de">Offen</p></description>
    <keywords><keyword>editor</keyword></keywords>
    <keywords xml:lang="de"><keyword>Editor</keyword></keywords>
    <screenshots><screenshot><caption>Editing</caption></screenshot></screenshots>
    <releases><release version="1.0"><description><p>First release</p></description></release></releases>
    <agreement><agreement_section><name>Privacy</name></agreement_section></agreement>
    </component>"""
    counts = missing_counts(xml, app_id)
    assert counts.all_fields == {"*": 9, "en": 0, "en_US": 0, "de": 6, "fr": 8}
    assert counts.core_fields == {"*": 4, "en": 0, "en_US": 0, "de": 1}


def test_missing_counts_only_include_editable_untranslated_text():
    xml = b"""<component><id>org.example.App</id><metadata_license>CC0</metadata_license>
    <name translate="no">Example</name><summary>Hello</summary><summary xml:lang="pt-BR">Oi</summary>
    <description><p>Open</p><p xml:lang="pt_BR" translate="no">Abrir</p></description></component>"""
    counts = {"*": 2, "en": 0, "en_US": 0, "pt_BR": 0}
    assert missing_counts(xml, "org.example.App") == queue._MissingCounts(
        all_fields=counts, core_fields=counts
    )
    for license in (b"", b" \n "):
        assert missing_counts(
            xml.replace(b"CC0", license), "org.example.App"
        ) == queue._MissingCounts(all_fields={}, core_fields={})


def test_private_use_translation_does_not_hide_other_languages():
    counts = missing_counts(
        b"<component><id>org.example.App</id><metadata_license>CC0</metadata_license>"
        b'<summary>Hello</summary><summary xml:lang="qaa" translate="no">Local</summary></component>',
        "org.example.App",
    ).core_fields
    assert counts["*"] == 1
    assert counts["qaa"] == 0


def test_queue_reads_shared_saves_before_publication_and_separates_recovery(
    monkeypatch,
):
    app_id = "org.example.App"
    batch = SimpleNamespace(
        app_id=app_id,
        error=None,
        recovered=False,
        pending=True,
        source_sha="sha",
        missing_texts=0,
        missing_listing_texts=None,
        listing_count_failed=False,
    )
    db = MagicMock()
    db.query.return_value.filter_by.return_value = [batch]
    monkeypatch.setattr(queue, "get_db", lambda _: nullcontext(db))
    apps = MagicMock()
    rows = [
        (app_id, "Example", "sha", {"*": 1}, None),
        ("org.example.Other", "Other", "other", {"*": 2}, None),
        ("org.example.Optional", "Optional", "optional", {"*": 5}, {"*": 0}),
        ("org.example.Unknown", None, None, None, None),
    ]
    apps.add_columns.return_value.outerjoin.return_value.order_by.return_value = rows
    monkeypatch.setattr(queue, "_apps", lambda _: apps)
    result = queue.language_queue("fr")
    assert result.indexing and [a.name for a in result.apps] == ["Other"]
    assert not result.attention
    batch.error = "source_changed"
    assert [a.app_id for a in queue.language_queue("fr").attention] == [app_id]
    batch.error = None
    batch.source_sha = "old-sha"
    rows[0] = (app_id, "Example", "sha", None, None)
    assert [a.app_id for a in queue.language_queue("fr").attention] == [app_id]


def test_language_queue_orders_by_update_then_app_id(monkeypatch):
    url = os.getenv("TRANSLATION_TEST_DATABASE_URL")
    if not url:
        pytest.skip("TRANSLATION_TEST_DATABASE_URL is not configured")
    engine = create_engine(url)
    try:
        with engine.connect() as conn, Session(conn) as session:
            conn.exec_driver_sql(
                """CREATE TEMP TABLE apps (
                    app_id text, type text DEFAULT 'desktop-application',
                    is_eol boolean DEFAULT false, appstream jsonb, last_updated_at timestamp
                )"""
            )
            conn.exec_driver_sql(
                "CREATE TEMP TABLE translationlisting "
                "(app_id text, sha text, missing jsonb, missing_listing jsonb)"
            )
            conn.exec_driver_sql(
                """CREATE TEMP TABLE metadatatranslationbatch (
                    app_id text, locale text, error text, previous_translations jsonb,
                    changes jsonb, source_sha text, missing_texts integer,
                    missing_listing_texts integer, listing_count_failed boolean
                )"""
            )
            conn.exec_driver_sql(
                """INSERT INTO apps (app_id, last_updated_at) VALUES
                    ('A', NULL), ('Z', '2026-03-01'), ('C', '2026-02-01'), ('B', '2026-02-01')"""
            )
            conn.exec_driver_sql(
                """INSERT INTO translationlisting (app_id, missing)
                   SELECT app_id, '{"*": 1}'::jsonb FROM apps"""
            )
            monkeypatch.setattr(queue, "get_db", lambda _: nullcontext(session))
            assert [app.app_id for app in queue.language_queue("de").apps] == [
                "Z",
                "B",
                "C",
                "A",
            ]
    finally:
        engine.dispose()


def test_index_continues_past_unavailable_repository(monkeypatch):
    monkeypatch.setattr(queue.config.settings, "github_bot_token", "test")
    db = MagicMock()
    monkeypatch.setattr(queue, "get_db", lambda _: nullcontext(db))
    apps = MagicMock()
    apps.outerjoin.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
        ("org.example.Blocked",),
        ("org.example.Available",),
    ]
    monkeypatch.setattr(queue, "_apps", lambda _: apps)
    github = MagicMock()
    monkeypatch.setattr(queue, "Github", lambda _: nullcontext(github))
    github.get_repo.side_effect = [
        GithubException(451, {"message": "Unavailable"}),
        object(),
    ]
    monkeypatch.setattr(
        queue,
        "read_source",
        lambda repo, app_id: SimpleNamespace(
            sha="sha",
            content=f"<component><id>{app_id}</id><metadata_license>CC0</metadata_license><name>Example</name><summary>Hello</summary></component>".encode(),
        ),
    )
    queue.refresh_index()
    deferred, indexed = [
        call.args[0].compile().params for call in db.execute.call_args_list
    ]
    assert deferred["app_id"] == "org.example.Blocked"
    assert "missing" not in deferred
    assert indexed["app_id"] == "org.example.Available"
    assert indexed["missing"]["*"] == 2
    assert indexed["missing_listing"]["*"] == 1


@pytest.fixture
def translation_db(monkeypatch):
    url = os.getenv("TRANSLATION_TEST_DATABASE_URL")
    if not url:
        pytest.skip("TRANSLATION_TEST_DATABASE_URL is not configured")
    scripts = ScriptDirectory(str(Path(__file__).parents[1] / "alembic"))
    migration = scripts.get_revision("7bbc44db5503")
    previous = scripts.get_revision("d5064a8eb13c")
    assert migration is not None and previous is not None
    engine = create_engine(url)
    try:
        with engine.connect() as conn:
            schema = "translation_test_" + uuid4().hex
            conn.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
            conn.exec_driver_sql(f'SET LOCAL search_path TO "{schema}"')
            conn.exec_driver_sql(
                "CREATE TABLE apps (app_id varchar PRIMARY KEY, type varchar, "
                "is_eol boolean, appstream jsonb, last_updated_at timestamp)"
            )
            app_id = "org.example.App"
            with Operations.context(MigrationContext.configure(conn)):
                previous.module.upgrade()
            conn.exec_driver_sql(
                "INSERT INTO apps (app_id, type, is_eol, appstream) "
                "VALUES (%s, 'desktop-application', false, '{}')",
                (app_id,),
            )
            conn.exec_driver_sql(
                "INSERT INTO translationlisting (app_id, checked_at, sha, missing) "
                "VALUES (%s, now() - interval '3 hours', 'source-sha', %s)",
                (app_id, '{"*": 9, "fr": 4}'),
            )
            with Operations.context(MigrationContext.configure(conn)):
                migration.module.upgrade()

            @contextmanager
            def get_db(_):
                with Session(bind=conn) as db:
                    yield db
                    db.flush()

            monkeypatch.setattr(queue, "get_db", get_db)
            monkeypatch.setattr(batches, "get_db", get_db)
            yield conn, app_id, migration.module
    finally:
        engine.dispose()


def _insert_legacy_batch(conn, app_id):
    conn.exec_driver_sql(
        "INSERT INTO metadatatranslationbatch "
        "(app_id, locale, revision, source_sha, path, state, missing_texts, content, changes) "
        "VALUES (%s, 'fr', 'revision', 'source-sha', 'app.xml', 'queued', 5, %s, %s)",
        (app_id, b"<component/>", '{"summary": "Bonjour"}'),
    )


def test_queue_count_migration_preserves_existing_counts_and_saved_edits(
    translation_db,
):
    conn, app_id, migration = translation_db
    with Operations.context(MigrationContext.configure(conn)):
        migration.downgrade()
        _insert_legacy_batch(conn, app_id)
        migration.upgrade()
        assert conn.exec_driver_sql(
            "SELECT missing, missing_listing FROM translationlisting"
        ).one() == ({"*": 9, "fr": 4}, None)
        assert conn.exec_driver_sql(
            "SELECT missing_texts, missing_listing_texts FROM metadatatranslationbatch"
        ).one() == (5, None)
        conn.exec_driver_sql(
            "UPDATE metadatatranslationbatch SET missing_listing_texts = 0"
        )
        migration.downgrade()
    assert conn.exec_driver_sql(
        "SELECT missing_texts, content, changes FROM metadatatranslationbatch"
    ).one() == (5, b"<component/>", {"summary": "Bonjour"})
    conn.exec_driver_sql(
        "UPDATE translationlisting SET sha = 'rollback-sha', missing = '{\"*\": 3}'"
    )
    assert conn.exec_driver_sql(
        "SELECT sha, missing FROM translationlisting"
    ).one() == (
        "rollback-sha",
        {"*": 3},
    )


def test_queue_prefers_current_batch_counts_until_legacy_content_changes(
    translation_db,
):
    conn, app_id, _ = translation_db
    _insert_legacy_batch(conn, app_id)
    assert queue.language_queue("fr").apps[0].app_id == app_id
    conn.exec_driver_sql(
        "UPDATE metadatatranslationbatch "
        "SET content = %s, missing_listing_texts = 0, listing_count_write_id = 'new-writer'",
        (b"<component>new writer</component>",),
    )
    assert not queue.language_queue("fr").apps
    conn.exec_driver_sql(
        "UPDATE metadatatranslationbatch SET content = %s",
        (b"<component>old writer</component>",),
    )
    assert queue.language_queue("fr").apps[0].app_id == app_id
    checked_at = conn.exec_driver_sql(
        "SELECT checked_at FROM translationlisting"
    ).scalar_one()
    queue._write_listing(
        app_id,
        checked_at,
        queue._ListingIndex(
            "source-sha",
            queue._MissingCounts(all_fields={"*": 9}, core_fields={"*": 0}),
        ),
    )
    result = queue.language_queue("fr")
    assert result.indexing and not result.apps
    batches.backfill_listing_counts()
    result = queue.language_queue("fr")
    assert not result.indexing and not result.apps
    conn.exec_driver_sql(
        "UPDATE metadatatranslationbatch SET content = %s",
        (
            b"<component><id>org.example.App</id><summary>Translate me</summary></component>",
        ),
    )
    assert queue.language_queue("fr").indexing
    batches.backfill_listing_counts()
    result = queue.language_queue("fr")
    assert not result.indexing and result.apps[0].app_id == app_id


def test_refresh_reindexes_legacy_rows_and_keeps_new_worker_results(
    translation_db, monkeypatch
):
    conn, app_id, _ = translation_db
    assert queue.language_queue("fr").apps[0].app_id == app_id
    monkeypatch.setattr(queue.config.settings, "github_bot_token", "test")
    monkeypatch.setattr(queue, "Github", lambda _: nullcontext(MagicMock()))
    monkeypatch.setattr(
        queue,
        "read_source",
        lambda repo, app_id: SimpleNamespace(
            sha="updated-sha",
            content=(
                f"<component><id>{app_id}</id><metadata_license>CC0</metadata_license>"
                "<name>Optional name</name></component>"
            ).encode(),
        ),
    )
    queue.refresh_index()
    assert not queue.language_queue("fr").apps
    checked_at = conn.exec_driver_sql(
        "SELECT checked_at FROM translationlisting"
    ).scalar_one()
    conn.exec_driver_sql(
        "UPDATE translationlisting SET sha = 'partial-legacy-result', checked_at = %s",
        (checked_at + timedelta(minutes=4),),
    )
    assert conn.exec_driver_sql(
        "SELECT checked_at, sha, missing FROM translationlisting"
    ).one() == (checked_at, "updated-sha", {"*": 1, "en": 0, "en_US": 0})
    queue._write_listing(app_id, checked_at - timedelta(minutes=2))
    queue._write_listing(
        app_id,
        checked_at - timedelta(minutes=1),
        queue._ListingIndex(
            "stale-sha", queue._MissingCounts(all_fields={"*": 9}, core_fields={"*": 4})
        ),
    )
    assert conn.exec_driver_sql(
        "SELECT checked_at, sha FROM translationlisting"
    ).one() == (checked_at, "updated-sha")
    failed_at = checked_at + timedelta(minutes=2)
    queue._write_listing(app_id, failed_at)
    queue._write_listing(
        app_id,
        checked_at + timedelta(minutes=1),
        queue._ListingIndex(
            "recovered-sha",
            queue._MissingCounts(all_fields={"*": 1}, core_fields={"*": 0}),
        ),
    )
    assert conn.exec_driver_sql(
        "SELECT checked_at, sha FROM translationlisting"
    ).one() == (failed_at, "recovered-sha")


def test_legacy_timestamp_only_write_fences_older_index_result_before_handoff(
    translation_db,
):
    conn, app_id, _ = translation_db
    checked_at = conn.exec_driver_sql(
        "SELECT checked_at FROM translationlisting"
    ).scalar_one()
    legacy_at = checked_at + timedelta(minutes=2)
    # Legacy merge emits only this update when the source is unchanged.
    conn.exec_driver_sql(
        "UPDATE translationlisting SET checked_at = %s",
        (legacy_at,),
    )
    queue._write_listing(
        app_id,
        checked_at + timedelta(minutes=1),
        queue._ListingIndex(
            "stale-before-revert",
            queue._MissingCounts(all_fields={"*": 9}, core_fields={"*": 4}),
        ),
    )
    assert conn.exec_driver_sql(
        "SELECT checked_at, sha, missing_listing FROM translationlisting"
    ).one() == (legacy_at, "source-sha", None)

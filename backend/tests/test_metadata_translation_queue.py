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
from requests.exceptions import Timeout
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
    db.query.return_value.filter.return_value = [batch]
    monkeypatch.setattr(queue, "get_db", lambda _: nullcontext(db))
    apps = MagicMock()
    rows = [
        (app_id, "Example", "sha", {"*": 1}, None, False),
        ("org.example.Other", "Other", "other", {"*": 2}, None, False),
        ("org.example.Optional", "Optional", "optional", {"*": 5}, {"*": 0}, False),
        ("org.example.Unknown", None, None, None, None, True),
    ]
    apps.add_columns.return_value.outerjoin.return_value.order_by.return_value = rows
    monkeypatch.setattr(queue, "_apps", lambda _: apps)
    result = queue.language_queue("fr")
    assert result.indexing and [a.name for a in result.apps] == ["Other"]
    assert result.first_checks_pending
    assert not result.attention
    batch.error = "source_changed"
    assert [a.app_id for a in queue.language_queue("fr").attention] == [app_id]
    batch.error = None
    batch.source_sha = "old-sha"
    rows[0] = (app_id, "Example", "sha", None, None, False)
    assert [a.app_id for a in queue.language_queue("fr").attention] == [app_id]


def test_language_queue_filters_addon_hosts_and_orders_by_update_then_id(monkeypatch):
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is not configured")
    engine = create_engine(url)
    try:
        with engine.connect() as conn, Session(conn) as session:
            conn.exec_driver_sql(
                """CREATE TEMP TABLE apps (
                    app_id text, type text DEFAULT 'desktop-application',
                    is_eol boolean DEFAULT false, appstream jsonb, summary jsonb,
                    last_updated_at timestamp
                )"""
            )
            conn.exec_driver_sql(
                "CREATE TEMP TABLE translationlisting "
                "(app_id text, sha text, missing jsonb, missing_listing jsonb, "
                "checked_at timestamp NOT NULL DEFAULT now())"
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
                """INSERT INTO apps (app_id, type, is_eol, appstream) VALUES
                   ('CLI', 'console-application', false, NULL),
                   ('SDK', 'runtime', false, NULL),
                   ('DesktopPlugin', 'addon', false, '{"extends": "B.desktop"}'),
                   ('ConsolePlugin', 'addon', false, '{"extends": "CLI"}'),
                   ('RuntimePlugin', 'addon', false, '{"extends": "SDK"}'),
                   ('UnknownPlugin', 'addon', false, '{"extends": "Missing"}'),
                   ('OrphanPlugin', 'addon', false, NULL),
                   ('Retired', 'addon', true, '{"extends": "B"}')"""
            )
            conn.exec_driver_sql(
                """INSERT INTO apps (app_id, type, appstream, summary) VALUES
                   ('VideositePlugin', 'addon',
                    '{"extends":"B.Videosite","bundle":{"value":"runtime/VideositePlugin/x86_64/stable"}}',
                    '{"extension_parents":{"runtime/VideositePlugin/x86_64/stable":"app/B"}}'),
                   ('MisleadingPlugin', 'addon',
                    '{"extends":"B","bundle":{"value":"runtime/MisleadingPlugin/x86_64/stable"}}',
                    '{"extension_parents":{"runtime/MisleadingPlugin/x86_64/stable":"runtime/SDK"}}')"""
            )
            conn.exec_driver_sql(
                """INSERT INTO metadatatranslationbatch (app_id, locale, changes) VALUES
                   ('RuntimePlugin', 'de', '{"summary":"Text"}'),
                   ('RemovedApp', 'de', '{"summary":"Text"}')"""
            )
            conn.exec_driver_sql(
                """INSERT INTO translationlisting (app_id, missing)
                   SELECT app_id, '{"*": 1}'::jsonb FROM apps"""
            )
            monkeypatch.setattr(queue, "get_db", lambda _: nullcontext(session))
            result = queue.language_queue("de")
            assert [app.app_id for app in result.apps] == [
                "Z",
                "B",
                "C",
                "A",
                "CLI",
                "ConsolePlugin",
                "DesktopPlugin",
                "VideositePlugin",
            ]
            assert [app.app_id for app in result.attention] == ["RemovedApp"]
    finally:
        engine.dispose()


def test_index_skips_eol_apps_before_fetching(monkeypatch, translation_db):
    conn, active_id, _ = translation_db
    conn.exec_driver_sql(
        "INSERT INTO apps (app_id,type,is_eol) "
        "VALUES ('org.example.Retired','desktop-application',true)"
    )
    monkeypatch.setattr(queue.config.settings, "github_bot_token", "test")
    github = MagicMock()
    github.get_repo.side_effect = GithubException(404, {})
    monkeypatch.setattr(queue, "Github", lambda _: nullcontext(github))

    queue.refresh_index()

    github.get_repo.assert_called_once_with(f"flathub/{active_id}")
    assert not queue.language_queue("de").indexing


def test_catalog_update_during_batch_keeps_later_app_due(translation_db, monkeypatch):
    conn, app_id, _ = translation_db
    clock = MagicMock(wraps=queue.datetime)
    start = queue.datetime.now(queue.UTC)
    clock.now.return_value = start
    monkeypatch.setattr(queue, "datetime", clock)
    conn.exec_driver_sql(
        "INSERT INTO apps (app_id, type, is_eol) VALUES ('First', 'desktop-application', false)"
    )
    monkeypatch.setattr(queue.config.settings, "github_bot_token", "test")
    github = MagicMock()

    def fetch(repo):
        if repo == "flathub/First":
            conn.exec_driver_sql(
                "UPDATE apps SET last_updated_at = %s WHERE app_id = %s",
                ((start + timedelta(seconds=1)).replace(tzinfo=None), app_id),
            )
            clock.now.return_value = start + timedelta(seconds=2)
        raise GithubException(404, {})

    github.get_repo.side_effect = fetch
    monkeypatch.setattr(queue, "Github", lambda _: nullcontext(github))
    queue.refresh_index()
    assert github.get_repo.call_count == 2
    assert queue.translation_index_status().due_for_recheck == 1


def test_status_counts_first_checks_separately_from_due_rechecks(translation_db):
    conn, _, _ = translation_db
    conn.exec_driver_sql(
        """INSERT INTO apps (app_id, type, is_eol) VALUES
           ('New', 'desktop-application', false), ('Retired', 'desktop-application', true)"""
    )
    assert queue.translation_index_status().model_dump() == {
        "eligible_apps": 2,
        "never_checked": 1,
        "due_for_recheck": 1,
    }


def test_index_continues_past_unavailable_repository(monkeypatch, translation_db):
    conn, app_id, _ = translation_db
    monkeypatch.setattr(queue.config.settings, "github_bot_token", "test")
    conn.exec_driver_sql(
        "INSERT INTO apps (app_id,type,is_eol) VALUES ('org.example.Blocked','desktop-application',false)"
    )
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
    deferred = conn.exec_driver_sql(
        "SELECT missing_listing FROM translationlisting WHERE app_id = 'org.example.Blocked'"
    ).one()
    assert deferred == (None,)
    indexed = conn.exec_driver_sql(
        "SELECT missing, missing_listing FROM translationlisting WHERE app_id = %s",
        (app_id,),
    ).one()
    assert indexed.missing["*"] == 2
    assert indexed.missing_listing["*"] == 1
    assert queue.translation_index_status().never_checked == 0
    assert not queue.language_queue("de").first_checks_pending
    blocked = queue.lookup_translation("org.example.Blocked", "de")
    assert (blocked.outcome, blocked.http_status) == ("github_error", 451)
    assert blocked.checked_at is not None
    assert blocked.queue_state == "absent" and blocked.missing is None
    listed = queue.lookup_translation(app_id, "de")
    assert (listed.outcome, listed.queue_state, listed.missing) == (
        "indexed",
        "listed",
        1,
    )


@pytest.mark.parametrize("status", [401, 429, 403, None])
def test_lookup_records_aborted_check_without_delaying_retry(
    translation_db, monkeypatch, status
):
    conn, _, _ = translation_db
    app_id = "org.example.New"
    conn.exec_driver_sql(
        "INSERT INTO apps (app_id, type, is_eol) VALUES (%s, 'desktop-application', false)",
        (app_id,),
    )
    monkeypatch.setattr(queue.config.settings, "github_bot_token", "test")
    github = MagicMock()
    github.get_repo.side_effect = (
        GithubException(status, {}, {"x-ratelimit-remaining": "0"})
        if status
        else Timeout()
    )
    monkeypatch.setattr(queue, "Github", lambda _: nullcontext(github))
    with pytest.raises(Timeout) if status is None else nullcontext():
        queue.refresh_index()
    github.get_repo.assert_called_once_with(f"flathub/{app_id}")
    result = queue.lookup_translation(app_id, "de")
    assert (result.outcome, result.http_status) == ("github_error", status)
    assert result.checked_at and result.queue_state == "absent"
    assert (
        conn.exec_driver_sql(
            "SELECT checked_at FROM translationlisting WHERE app_id=%s", (app_id,)
        ).first()
        is None
    )


@pytest.mark.parametrize(
    ("fields", "outcome"),
    [
        ("", "no_editable_metadata"),
        (
            '<summary>Hello</summary><summary xml:lang="de">Hallo</summary><summary xml:lang="de">Hi</summary><description><p>Open</p></description>',
            "ambiguous_translations",
        ),
        ('<summary>Hello</summary><summary xml:lang="de">Hallo</summary>', "indexed"),
    ],
)
def test_lookup_distinguishes_empty_ambiguous_and_translated_listings(
    translation_db, monkeypatch, fields, outcome
):
    _, app_id, _ = translation_db
    monkeypatch.setattr(queue.config.settings, "github_bot_token", "test")
    monkeypatch.setattr(queue, "Github", lambda _: nullcontext(MagicMock()))
    content = f"<component><id>{app_id}</id><metadata_license>CC0</metadata_license>{fields}</component>".encode()
    monkeypatch.setattr(
        queue, "read_source", lambda *_: SimpleNamespace(sha="sha", content=content)
    )
    queue.refresh_index()
    result = queue.lookup_translation(app_id, "de")
    assert result.outcome == outcome and result.queue_state == "absent"


def test_lookup_uses_catalog_and_legacy_results_without_guessing(translation_db):
    conn, app_id, _ = translation_db
    conn.exec_driver_sql("""INSERT INTO apps (app_id, type, is_eol) VALUES
        ('org.example.Retired','desktop-application',true),
        ('org.example.SDK','runtime',false),
        ('org.example.New','desktop-application',false)""")
    assert (
        queue.lookup_translation("org.example.Missing", "de").eligibility == "unknown"
    )
    assert queue.lookup_translation("org.example.Retired", "de").eligibility == "eol"
    assert queue.lookup_translation("org.example.SDK", "de").eligibility == "excluded"
    new = queue.lookup_translation("org.example.New", "de")
    assert new.checked_at is None and new.eligibility == "eligible"
    legacy = queue.lookup_translation(app_id, "fr")
    assert legacy.checked_at and legacy.outcome is None
    assert legacy.queue_state == "listed" and legacy.missing == 4
    _insert_legacy_batch(conn, app_id)
    conn.exec_driver_sql("UPDATE metadatatranslationbatch SET missing_listing_texts=0")
    completed = queue.lookup_translation(app_id, "fr")
    assert completed.queue_state == "absent" and completed.missing == 0
    conn.exec_driver_sql("UPDATE metadatatranslationbatch SET error='source_changed'")
    assert queue.lookup_translation(app_id, "fr").queue_state == "attention"


@pytest.fixture
def translation_db(monkeypatch):
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is not configured")
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
                "is_eol boolean, appstream jsonb, summary jsonb, last_updated_at timestamp)"
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
                scripts.get_revision("18cc6e5235d9").module.upgrade()
                scripts.get_revision("d18b529f34bc").module.upgrade()

            @contextmanager
            def get_db(_, *, repeatable_read=False):
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

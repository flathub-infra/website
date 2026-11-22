import os
from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from github import GithubException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import metadata_translation_queue as queue
from app.metadata_translation_queue import missing_counts


def test_missing_counts_only_include_editable_untranslated_text():
    xml = b"""<component><id>org.example.App</id><metadata_license>CC0</metadata_license>
    <name translate="no">Example</name><summary>Hello</summary><summary xml:lang="pt-BR">Oi</summary>
    <description><p>Open</p><p xml:lang="pt_BR" translate="no">Abrir</p></description></component>"""
    counts = missing_counts(xml, "org.example.App")
    assert counts == {"*": 2, "en": 0, "en_US": 0, "pt_BR": 0}
    assert not missing_counts(xml.replace(b"CC0", b""), "org.example.App")
    assert not missing_counts(xml.replace(b"CC0", b" \n "), "org.example.App")


def test_private_use_translation_does_not_hide_other_languages():
    counts = missing_counts(
        b"<component><id>org.example.App</id><metadata_license>CC0</metadata_license>"
        b'<summary>Hello</summary><summary xml:lang="qaa" translate="no">Local</summary></component>',
        "org.example.App",
    )
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
    )
    db = MagicMock()
    db.query.return_value.filter_by.return_value = [batch]
    monkeypatch.setattr(queue, "get_db", lambda _: nullcontext(db))
    apps = MagicMock()
    apps.add_columns.return_value.outerjoin.return_value.order_by.return_value = [
        (app_id, "Example", "sha", {"*": 1}),
        ("org.example.Other", "Other", "other", {"*": 2}),
        ("org.example.Unknown", None, None, None),
    ]
    monkeypatch.setattr(queue, "_apps", lambda _: apps)
    result = queue.language_queue("fr")
    assert result.indexing and [a.name for a in result.apps] == ["Other"]
    assert not result.attention
    batch.error = "source_changed"
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
                "CREATE TEMP TABLE translationlisting (app_id text, sha text, missing jsonb)"
            )
            conn.exec_driver_sql(
                """CREATE TEMP TABLE metadatatranslationbatch (
                    app_id text, locale text, error text, previous_translations jsonb,
                    changes jsonb, source_sha text, missing_texts integer
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
            content=f"<component><id>{app_id}</id><metadata_license>CC0</metadata_license><name>Example</name></component>".encode(),
        ),
    )
    queue.refresh_index()
    assert db.get.return_value.checked_at is not None
    (listing,) = db.merge.call_args.args
    assert listing.app_id == "org.example.Available" and listing.missing["*"] == 1

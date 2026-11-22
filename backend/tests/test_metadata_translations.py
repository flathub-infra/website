import json
from base64 import b64encode
from contextlib import contextmanager
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
import yaml
from github import GithubException
from lxml import etree
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import metadata_translation_batches as batches
from app.metadata_translation_github import (
    _direct_install,
    _install_commands,
    _load_manifest,
    _owns_metadata,
    read_source,
    read_translation_document,
    submit_translation,
)
from app.metadata_translation_reconciliation import reconcile
from app.metadata_translations import (
    LANG,
    MAX_XML_BYTES,
    MetadataDocument,
    MetadataError,
)
from app.models import MetadataTranslationBatch

APP_ID = "org.example.App"
XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<!-- Keep this comment -->
<component type="desktop-application">
  <id>org.example.App</id>
  <metadata_license>CC0-1.0</metadata_license>
  <name>Example</name>
  <name_variant_suffix>Preview</name_variant_suffix>
  <developer><name>Example authors</name></developer>
  <summary>Read &amp; write</summary>
  <summary xml:lang="de">Lesen und schreiben</summary>
  <summary xml:lang="fr">Lire et \xc3\xa9crire</summary>
  <description>
    <p>Use <em>Example</em> with <code>{name}</code>.</p>
    <p xml:lang="de">Verwende <em>Example</em> mit <code>{name}</code>.</p>
    <p>Second paragraph.</p>
    <ul><li>First item</li><li>Second item</li></ul>
    <p translate="no">Do not translate.</p>
  </description>
  <keywords><keyword>editor</keyword><keyword>text</keyword></keywords>
  <keywords xml:lang="de"><keyword>Editor</keyword><keyword>Text</keyword></keywords>
  <screenshots><screenshot><caption>Editing a document</caption><image>https://example.org/1.png</image></screenshot></screenshots>
  <releases><release version="1.0"><description><p>First release</p></description></release></releases>
  <agreement><agreement_section type="privacy"><name>Privacy</name><description><p>Privacy terms</p></description></agreement_section></agreement>
</component>
"""


@pytest.fixture
def batch_db(monkeypatch):
    engine = create_engine("sqlite://")
    MetadataTranslationBatch.__table__.create(engine)

    @contextmanager
    def database(kind="writer"):
        with Session(engine) as session:
            yield session
            session.commit()

    monkeypatch.setattr(batches, "get_db", database)
    monkeypatch.setattr(batches.config.settings, "github_bot_token", "test-token")
    yield database
    engine.dispose()


def test_batch_counts_only_core_listing_fields_as_missing(batch_db, publishing_repo):
    repo, _ = publishing_repo
    fields = {
        u.id: u.source
        for u in document().units()
        if u.field in {"summary", "description", "keywords", "caption"}
        and not u.translation
    }
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, fields, 42)
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.missing_listing_texts == 0
        assert batch.missing_texts == 6
        saved = batch.content
        batch.missing_listing_texts = None
    batches.backfill_listing_counts()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.missing_listing_texts == 0
        assert batch.missing_texts == 6
        assert batch.content == saved
    _, loaded, _, _, _, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert {u.field for u in loaded.units() if not u.translation} == {
        "name",
        "name_variant_suffix",
        "developer_name",
        "release",
        "agreement",
    }


@pytest.mark.parametrize("clear_snapshot", [False, True])
def test_backfill_does_not_discard_publication_result(
    batch_db, publishing_repo, clear_snapshot
):
    repo, _ = publishing_repo
    field = unit(document(), "summary")
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {field.id: "Neu"}, 42)
    with batch_db() as db:
        db.query(MetadataTranslationBatch).one().missing_listing_texts = None

    now = datetime.now(UTC).replace(tzinfo=None)
    with batches._publication(APP_ID, "de", now) as batch:
        assert batch is not None
        batches.backfill_listing_counts()
        if clear_snapshot:
            source = repo.get_contents("", ref=batch.revision)[0]
            source.decoded_content = batch.content
            source.sha = "new-sha"
            batches._rebase_batch(repo, batch, APP_ID, "de", batch.revision)
        else:
            batch.state = "submitted"
            batch.url = "https://github.com/flathub/org.example.App/pull/1"
            batch.changes = {}

    with batch_db() as db:
        stored = db.query(MetadataTranslationBatch).one()
        assert stored.state == "submitted"
        assert stored.url == batch.url
        if clear_snapshot:
            assert stored.content is None and stored.source_sha == "new-sha"
            assert stored.missing_texts is None
            assert stored.missing_listing_texts is None
        else:
            assert stored.missing_listing_texts is not None


def test_batch_saves_reload_without_github_writes_then_publish_once(
    batch_db, publishing_repo
):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    name = unit(document(), "name")
    result = batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Neu"}, 42
    )
    assert result["url"] is None and result["state"] == "queued"
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {name.id: "Beispiel"}, 42)
    repo.update_file.assert_not_called()
    repo.create_pull.assert_not_called()
    _, loaded, state, error, url, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert state == "queued" and error is None and url is None
    assert unit(loaded, "summary").translation == "Neu"
    assert unit(loaded, "name").translation == "Beispiel"
    batches.publish_translation_batches()
    repo.update_file.assert_called_once()
    repo.create_pull.assert_called_once()
    assert unit(document(saved.decoded_content), "summary").translation == "Neu"
    assert unit(document(saved.decoded_content), "name").translation == "Beispiel"
    batches.publish_translation_batches()
    repo.update_file.assert_called_once()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.changes == {}
        assert batch.state == "submitted"
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Noch neuer"}, 42
    )
    repo.update_file.assert_called_once()
    batches.publish_translation_batches()
    assert repo.update_file.call_count == 2
    repo.create_pull.assert_called_once()


def with_obsolete_release_translation(content):
    return content.replace(
        b"<p>Preview</p>", b'<p>Preview</p><p xml:lang="de">Vorschau</p>'
    )


@pytest.fixture
def legacy_release_batch(batch_db, publishing_repo):
    repo, saved = publishing_repo
    metadata = repo.get_contents("", ref="a" * 40)[0]
    saved.decoded_content = metadata.decoded_content = XML.replace(
        b"</releases>",
        b'<release version="0.9"><description><p>Preview</p></description></release></releases>',
    )
    latest = unit(document(metadata.decoded_content), "release").id
    obsolete = latest.replace("release[1]", "release[2]")
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {latest: "Aktuell"}, 42)
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        batch.content = with_obsolete_release_translation(batch.content)
        batch.changes = {**batch.changes, obsolete: "Vorschau"}
        batch.publication_base = dict.fromkeys(batch.changes, "")
    return repo, saved, latest


@pytest.mark.parametrize("save_again", [False, True])
def test_obsolete_queued_release_edits_do_not_block_publication(
    batch_db, legacy_release_batch, save_again
):
    repo, saved, latest = legacy_release_batch
    if save_again:
        batches.queue_translation(repo, APP_ID, "de", "a" * 40, {latest: "Neu"}, 42)
    batches.publish_translation_batches()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.state == "submitted" and not batch.changes
    repo.create_pull.assert_called_once()
    assert unit(document(saved.decoded_content), "release").translation == (
        "Neu" if save_again else "Aktuell"
    )
    assert b"Vorschau" not in saved.decoded_content


@pytest.fixture
def repo_with_obsolete_only_batch(batch_db, legacy_release_batch):
    repo, _, latest = legacy_release_batch
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        batch.changes = {k: v for k, v in batch.changes.items() if k != latest}
        batch.publication_base = dict.fromkeys(batch.changes, "")
        batch.content = with_obsolete_release_translation(batch.source_content)
    return repo


def test_obsolete_only_batch_needs_no_publication(
    batch_db, repo_with_obsolete_only_batch
):
    batches.publish_translation_batches()
    repo_with_obsolete_only_batch.create_pull.assert_not_called()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.state == "submitted" and not batch.changes


def test_obsolete_only_batch_allows_new_source(batch_db, repo_with_obsolete_only_batch):
    repo = repo_with_obsolete_only_batch
    metadata = repo.get_contents("", ref="a" * 40)[0]
    metadata.sha = "new-sha"
    metadata.decoded_content = metadata.decoded_content.replace(
        b"Read &amp; write", b"New summary"
    )
    source, doc, _, error, _, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert error is None and source.sha == metadata.sha
    summary = unit(doc, "summary")
    assert summary.source == "New summary"
    batches.queue_translation(
        repo, APP_ID, "de", source.revision, {summary.id: "Neu"}, 42
    )
    with batch_db() as db:
        assert db.query(MetadataTranslationBatch).one().changes == {summary.id: "Neu"}


@pytest.mark.parametrize("orphan_edit", [b"Aktuell", b"First release"])
def test_retry_omits_obsolete_notes_already_written_to_branch(
    batch_db, legacy_release_batch, orphan_edit
):
    repo, saved, _ = legacy_release_batch
    with batch_db() as db:
        legacy_content = db.query(MetadataTranslationBatch).one().content
    create = repo.create_pull.side_effect
    repo.create_pull.side_effect = ConnectionResetError()
    with pytest.raises(ConnectionResetError):
        batches.publish_translation_batches()
    orphan = legacy_content.replace(orphan_edit, b"Orphan wording").replace(
        b"Vorschau</p>", b'Korrektur</p><p xml:lang="fr">Aper\xc3\xa7u</p>'
    )
    saved.decoded_content = orphan
    repo.create_pull.side_effect = create
    batches.publish_translation_batches()
    batches.publish_translation_batches()
    pull = repo.pulls[1]
    published = repo.get_contents(saved.path, ref=pull.head.sha).decoded_content
    assert saved.decoded_content == orphan
    source = read_source(repo, APP_ID)
    assert (
        document(published).obsolete_releases()
        == document(source.content).obsolete_releases()
    )
    assert unit(document(published), "release").translation == "Aktuell"


def test_obsolete_release_comparison_preserves_locale_spelling_and_markup():
    old = b'<p xml:lang="pt-BR"><code>antigo</code></p>'
    xml = XML.replace(
        b"</releases>",
        b'<release version="0.9"><description><p><code>old</code></p>'
        + old
        + b"</description></release></releases>",
    )
    doc = document(xml, "pt-BR")
    valid = doc.apply({unit(doc, "summary").id: "Novo"})
    orphan = valid.replace(old, b'<p xml:lang="pt_BR"><code>old</code></p>')
    assert (
        document(xml, "pt-BR").obsolete_releases()
        == document(valid, "pt-BR").obsolete_releases()
    )
    assert (
        document(xml, "pt-BR").obsolete_releases()
        != document(orphan, "pt-BR").obsolete_releases()
    )


@pytest.mark.parametrize(
    ("state", "merged", "queued", "review", "pruned"),
    [
        ("open", False, False, "same", False),
        ("closed", False, False, "same", False),
        ("closed", True, True, "same", False),
        ("closed", True, False, "edited", True),
        ("closed", True, False, "missing", True),
        ("closed", True, False, "invalid", True),
        ("closed", True, False, "oversized", True),
        ("closed", True, False, "same", True),
    ],
)
def test_prune_only_merged_snapshots_without_pending_edits(
    batch_db, publishing_repo, state, merged, queued, review, pruned
):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    recovered = summary.model_copy(update={"translation": "Recovered"}).model_dump()
    expected_history = [recovered]
    if pruned and review != "same":
        expected_history.append(
            summary.model_copy(update={"translation": "Published"}).model_dump()
        )
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Published"}, 42
    )
    batches.publish_translation_batches()
    if queued:
        batches.queue_translation(
            repo, APP_ID, "de", "a" * 40, {summary.id: "Queued"}, 42
        )
    with batch_db() as db:
        db.query(MetadataTranslationBatch).one().previous_translations = [recovered]
    pull = repo.pulls[1]
    pull.state, pull.merged = state, merged
    pull.merge_commit_sha = "merge-sha"
    read_contents = repo.get_contents.side_effect

    def get_contents(path, ref):
        if ref != "merge-sha":
            return read_contents(path, ref)
        if review == "missing":
            raise GithubException(404, {"message": "Not found"})
        if review == "oversized":
            return SimpleNamespace(encoding="none")
        return SimpleNamespace(
            decoded_content={
                "same": saved.decoded_content,
                "edited": XML,
                "invalid": b"<broken",
            }[review]
        )

    repo.get_contents.side_effect = get_contents
    # Publication history can contain several PRs from the same branch.
    repo.pulls[2] = SimpleNamespace(
        number=2, head=pull.head, state="closed", merged=False
    )
    batches.prune_translation_snapshots()
    if not queued:
        repo.get_pull.assert_called_once_with(1)
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert (batch.source_content is None) is pruned
        assert (batch.content is None) is pruned
        assert batch.previous_translations == expected_history
        assert batch.url == pull.html_url
        if state == "closed" and not merged and not queued:
            assert batch.error == "pull_request_closed"
    if pruned:
        _, loaded, _, error, url, previous = batches.read_saved_translation(
            repo, read_source(repo, APP_ID), APP_ID, "de"
        )
        assert error is None and url == pull.html_url and previous == expected_history
        assert unit(loaded, "summary").translation == summary.translation
        batches.queue_translation(
            repo, APP_ID, "de", "a" * 40, {summary.id: "New edit"}, 42
        )
        with batch_db() as db:
            batch = db.query(MetadataTranslationBatch).one()
            assert batch.generation == 1
            assert batch.url is None
            assert batch.source_content == XML


def test_reviewed_duplicate_paragraph_does_not_hide_omitted_edit():
    xml = XML.replace(b"<p>Second paragraph.</p>", b"<p>Repeated</p><p>Repeated</p>")
    previous = document(xml)
    ids = [unit.id for unit in previous.units() if unit.source == "Repeated"]
    saved = document(xml).apply({key: "Same" for key in ids})
    reviewed = document(xml).apply({ids[0]: "Same", ids[1]: "Reviewed"})
    omitted = batches._omitted_edits(previous, saved, document(reviewed), ())
    assert [(unit.id, unit.translation) for unit in omitted] == [
        (key, "Same") for key in ids
    ]


def test_pruning_rechecks_batch_after_github_call(batch_db, publishing_repo):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "First"}, 42)
    batches.publish_translation_batches()
    pull = repo.pulls[1]
    evidence = SimpleNamespace(
        merged=True, merge_commit_sha="merge-sha", base=SimpleNamespace(ref="master")
    )
    original_read = repo.get_contents.side_effect

    def read(path, ref):
        if ref == "merge-sha":
            batches.queue_translation(
                repo, APP_ID, "de", "a" * 40, {summary.id: "New edit"}, 42
            )
            return saved
        return original_read(path, ref)

    repo.get_pull.side_effect = [evidence, pull, pull]
    repo.get_contents.side_effect = read
    batches.prune_translation_snapshots()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.state == "queued"
        assert unit(document(batch.content), "summary").translation == "New edit"
        assert batch.source_content is not None


@pytest.mark.parametrize("revert", [False, True])
def test_merge_during_publication_preserves_later_edits(
    batch_db, publishing_repo, revert
):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "First"}, 42)
    batches.publish_translation_batches()
    later = summary.translation if revert else "Later"
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: later}, 42)
    merged = SimpleNamespace(decoded_content=saved.decoded_content)
    read_contents = repo.get_contents.side_effect
    repo.get_contents.side_effect = lambda path, ref: (
        merged if ref == "merge-sha" else read_contents(path, ref)
    )
    pull = repo.pulls[1]
    update = repo.update_file.side_effect

    def merge_then_update(*args, **kwargs):
        pull.state, pull.merged, pull.merge_commit_sha = "closed", True, "merge-sha"
        master = read_contents("", "a" * 40)[0]
        master.decoded_content, master.sha = merged.decoded_content, "merged-blob"
        repo.get_branch.return_value.commit.sha = "b" * 40
        return update(*args, **kwargs)

    repo.update_file.side_effect = merge_then_update
    batches.publish_translation_batches()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert (batch.state, batch.error) == ("queued", None)
        assert list(batch.changes.values()) == [later]
    repo.update_file.side_effect = update
    batches.publish_translation_batches()
    assert repo.create_pull.call_count == 2
    assert (
        unit(
            document(
                repo.get_contents(
                    f"{APP_ID}.metainfo.xml",
                    ref=repo.create_pull.call_args.kwargs["head"],
                ).decoded_content
            ),
            "summary",
        ).translation
        == later
    )


def test_new_source_after_pruning_accepts_saves(batch_db, publishing_repo):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Published"}, 42
    )
    batches.publish_translation_batches()
    pull = repo.pulls[1]
    pull.state, pull.merged, pull.merge_commit_sha = "closed", True, "merged"
    read = repo.get_contents.side_effect
    metadata = read("", "a" * 40)[0]
    metadata.sha = "new-sha"
    metadata.decoded_content = saved.decoded_content
    repo.get_branch.return_value.commit.sha = "b" * 40
    batches.prune_translation_snapshots()
    with batch_db() as db:
        assert db.query(MetadataTranslationBatch).one().content is None
    batches.queue_translation(
        repo, APP_ID, "de", "b" * 40, {summary.id: "New edit"}, 42
    )


def test_open_pr_review_before_unrelated_save_keeps_original(batch_db, publishing_repo):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Mine"}, 42)
    batches.publish_translation_batches()
    saved.decoded_content = saved.decoded_content.replace(b"Mine", b"Reviewed")
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {unit(document(), "name").id: "Name"}, 42
    )
    snap = batches.unavailable_source_snapshot(APP_ID, "de")
    assert not snap["can_submit"]
    assert snap["batch_error"] == "source_unavailable"
    assert [u["translation"] for u in snap["previous_translations"]] == ["Mine"]
    assert (
        next(u.translation for u in snap["units"] if u.field == "summary") == "Reviewed"
    )


def test_dismiss_recovered_translation_is_scoped_and_idempotent(batch_db):
    repo, _ = saving_repo()
    summary = unit(document(), "summary")
    first = summary.model_copy(update={"translation": "First"}).model_dump()
    second = summary.model_copy(update={"translation": "Second"}).model_dump()
    for language in ("de", "fr"):
        batches.queue_translation(
            repo, APP_ID, language, "a" * 40, {summary.id: "Queued"}, 42
        )
        with batch_db() as db:
            db.query(MetadataTranslationBatch).filter_by(
                locale=language
            ).one().previous_translations = [first, second]
    for _ in range(2):
        assert batches.dismiss_previous_translation(APP_ID, "de", first) == [second]
    with batch_db() as db:
        rows = (
            db.query(MetadataTranslationBatch)
            .order_by(MetadataTranslationBatch.locale)
            .all()
        )
        assert [row.previous_translations for row in rows] == [
            [second],
            [first, second],
        ]
        assert all(row.changes == {summary.id: "Queued"} for row in rows)


def test_invalid_manifest_encoding_does_not_block_other_batches(batch_db, monkeypatch):
    invalid_repo, _ = saving_repo()
    healthy_repo, healthy_saved = saving_repo()
    other_app = "org.example.Other"
    for file in healthy_repo.get_contents("", ref="a" * 40):
        file.name = file.name.replace(APP_ID, other_app)
        file.path = file.path.replace(APP_ID, other_app)
        file.decoded_content = file.decoded_content.replace(
            APP_ID.encode(), other_app.encode()
        )
    healthy_saved.decoded_content = healthy_saved.decoded_content.replace(
        APP_ID.encode(), other_app.encode()
    )
    summary = unit(document(), "summary")
    batches.queue_translation(
        invalid_repo, APP_ID, "de", "a" * 40, {summary.id: "Saved"}, 42
    )
    batches.queue_translation(
        healthy_repo, other_app, "de", "a" * 40, {summary.id: "Healthy"}, 43
    )
    invalid_repo.get_contents("", ref="a" * 40)[1].decoded_content += b"\n# caf\xe9\n"
    repositories = {
        f"flathub/{APP_ID}": invalid_repo,
        f"flathub/{other_app}": healthy_repo,
    }
    monkeypatch.setattr(
        batches, "Github", lambda _: SimpleNamespace(get_repo=repositories.__getitem__)
    )
    batches.publish_translation_batches()
    with batch_db() as db:
        invalid = db.query(MetadataTranslationBatch).filter_by(app_id=APP_ID).one()
        assert (invalid.state, invalid.error) == ("failed", "unsupported_metadata")
        assert invalid.changes == {summary.id: "Saved"}
        healthy = db.query(MetadataTranslationBatch).filter_by(app_id=other_app).one()
        assert (healthy.state, healthy.error) == ("submitted", None)
    invalid_repo.create_pull.assert_not_called()
    healthy_repo.create_pull.assert_called_once()


def test_failed_batch_retains_saved_text_and_retries(
    batch_db, monkeypatch, publishing_repo
):
    repo, _ = publishing_repo
    changes = {unit(document(), "summary").id: "Neu"}
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, changes, 42)
    submit = MagicMock(side_effect=GithubException(503, {"message": "unavailable"}))
    monkeypatch.setattr(batches, "submit_translation", submit)
    batches.publish_translation_batches()
    _, loaded, state, error, _, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert (state, error) == ("failed", "github_unavailable")
    assert unit(loaded, "summary").translation == "Neu"
    submit.side_effect = None
    submit.return_value = {
        "url": "https://github.com/flathub/example/pull/1",
        "state": "open",
    }
    batches.publish_translation_batches()
    assert submit.call_count == 2
    with batch_db() as db:
        assert db.query(MetadataTranslationBatch).one().changes == {}


def test_batch_source_conflict_keeps_saved_text_without_publishing(
    batch_db, publishing_repo
):
    repo, _ = publishing_repo
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {unit(document(), "summary").id: "Neu"}, 42
    )
    source_file = repo.get_contents("", ref="a" * 40)[0]
    source_file.sha = "changed"
    source_file.decoded_content = XML.replace(b"Read &amp; write", b"New source")
    batches.publish_translation_batches()
    _, loaded, state, error, _, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert (state, error) == ("failed", "source_changed")
    assert unit(loaded, "summary").source == "Read & write"
    assert unit(loaded, "summary").translation == "Neu"
    repo.create_pull.assert_not_called()


def test_shared_batch_rejects_unknown_fields(batch_db):
    repo, _ = saving_repo()
    summary = unit(document(), "summary")
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Neu"}, 42)
    _, other, state, _, _, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert state == "queued"
    assert unit(other, "summary").translation == "Neu"
    assert unit(other, "summary").last_editor_id == 42
    with pytest.raises(MetadataError, match="invalid_units"):
        batches.queue_translation(repo, APP_ID, "de", "a" * 40, {"invalid": "bad"}, 42)
    with batch_db() as db:
        assert db.query(MetadataTranslationBatch).one().changes == {summary.id: "Neu"}


def test_shared_saves_compare_only_changed_fields_and_publish_together(
    batch_db, publishing_repo
):
    repo, saved = publishing_repo
    source = read_source(repo, APP_ID)
    _, doc, *_ = batches.read_saved_translation(repo, source, APP_ID, "de")
    summary, name = unit(doc, "summary"), unit(doc, "name")

    def save(actor, key, value, version):
        return batches.queue_translation(
            repo,
            APP_ID,
            "de",
            source.revision,
            {key: value},
            actor,
            versions={key: version},
        )

    first = save(42, summary.id, "First", summary.version)
    second = save(43, name.id, "Second", name.version)
    latest = {u.id: u for u in second["units"]}
    assert latest[summary.id].translation == "First"
    assert latest[summary.id].last_editor_id == 42
    assert latest[name.id].last_editor_id == 43
    with pytest.raises(batches.TextConflict) as exc:
        save(43, summary.id, "My draft", summary.version)
    assert exc.value.unit == latest[summary.id]
    with pytest.raises(batches.TextConflict):
        batches.queue_translation(
            repo,
            APP_ID,
            "de",
            source.revision,
            {name.id: "Not committed", summary.id: "Stale"},
            43,
            versions={name.id: latest[name.id].version, summary.id: summary.version},
        )
    assert first["units"][0].version != summary.version
    save(43, summary.id, "Reconciled", exc.value.unit.version)
    batches.publish_translation_batches()
    repo.create_pull.assert_called_once()
    assert repo.create_pull.call_args.kwargs["head"].startswith("translations/de/")
    assert unit(document(saved.decoded_content), "summary").translation == "Reconciled"
    assert unit(document(saved.decoded_content), "name").translation == "Second"
    _, loaded, *_ = batches.read_saved_translation(repo, source, APP_ID, "de")
    assert unit(loaded, "summary").last_editor_id == 43
    assert unit(loaded, "name").translation == "Second"
    assert latest[name.id].last_editor_id == 43
    merged = document(saved.decoded_content)
    assert unit(merged, "name").id != name.id
    with batch_db() as db:
        attributed = batches._annotate(
            merged, db.query(MetadataTranslationBatch).one().field_edits
        )
    assert unit(attributed, "name").last_editor_id == 43
    assert unit(attributed, "name").version == latest[name.id].version


def test_unrelated_local_file_does_not_change_metadata_ownership():
    filename = f"{APP_ID}.metainfo.xml"
    module = {
        "buildsystem": "simple",
        "build-commands": [f"install -Dm644 {filename} /app/share/metainfo/"],
        "sources": [
            {"type": "file", "path": filename},
            {"type": "file", "path": "icon.svg"},
        ],
    }
    assert _owns_metadata({"modules": [module]}, filename, APP_ID)
    module["sources"][1]["dest-filename"] = filename
    assert not _owns_metadata({"modules": [module]}, filename, APP_ID)


def test_batch_uses_last_save_and_current_repository_revision(
    batch_db, publishing_repo
):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    for value in ("Erster Versuch", "Letzter Versuch"):
        batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: value}, 42)
    repo.get_branch.return_value.commit.sha = "b" * 40
    batches.publish_translation_batches()
    assert (
        unit(document(saved.decoded_content), "summary").translation
        == "Letzter Versuch"
    )
    repo.update_file.assert_called_once()


def test_pending_batch_reload_allows_saves_after_unrelated_commit(batch_db):
    repo, _ = saving_repo()
    summary = unit(document(), "summary")
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Neu"}, 42)
    repo.get_branch.return_value.commit.sha = "b" * 40
    source, loaded, state, error, _, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert (state, error) == ("queued", None)
    assert source.revision == "b" * 40
    assert unit(loaded, "summary").translation == "Neu"
    name = unit(loaded, "name")
    batches.queue_translation(
        repo, APP_ID, "de", source.revision, {name.id: "Beispiel"}, 42
    )
    _, reloaded, _, _, _, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert unit(reloaded, "summary").translation == "Neu"
    assert unit(reloaded, "name").translation == "Beispiel"
    repo.update_file.assert_not_called()


@pytest.mark.parametrize("value", ["x" * 200, "&" * 40, "é" * 100])
def test_oversized_serialized_save_preserves_previous_batch(batch_db, value):
    repo, _ = saving_repo()
    metadata = repo.get_contents("", ref="a" * 40)[0]
    metadata.decoded_content = XML.replace(
        b"Keep this comment",
        b"Keep this comment" + b"x" * (MAX_XML_BYTES - 100 - len(XML)),
    )
    metadata.size = len(metadata.decoded_content)
    summary = unit(document(), "summary")
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Neu"}, 42)
    with batch_db() as db:
        previous_content = db.query(MetadataTranslationBatch).one().content
    with pytest.raises(MetadataError, match="metadata_too_large"):
        batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: value}, 42)
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.content == previous_content
        assert batch.changes == {summary.id: "Neu"}
    _, loaded, _, _, _, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert unit(loaded, "summary").translation == "Neu"
    repo.update_file.assert_not_called()


def test_rebase_retains_changed_text_and_allows_saves_and_publication(
    batch_db, monkeypatch, publishing_repo
):
    repo, _ = publishing_repo
    summary = unit(document(), "summary")
    name = unit(document(), "name")
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Neu", name.id: "Beispiel"}, 42
    )
    metadata = repo.get_contents("", ref="a" * 40)[0]
    metadata.sha = "new-sha"
    metadata.decoded_content = XML.replace(b"Read &amp; write", b"New source")
    repo.get_branch.return_value.commit.sha = "b" * 40
    batches.rebase_translation(repo, APP_ID, "de", "a" * 40)
    source, loaded, state, error, _, previous = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert source.revision == "b" * 40
    assert (state, error) == ("queued", None)
    assert unit(loaded, "name").translation == "Beispiel"
    assert [(item["source"], item["translation"]) for item in previous] == [
        (summary.source, "Neu")
    ]
    with pytest.raises(MetadataError, match="source_changed"):
        batches.rebase_translation(repo, APP_ID, "de", "a" * 40)
    batches.queue_translation(
        repo, APP_ID, "de", source.revision, {unit(loaded, "summary").id: "Aktuell"}, 42
    )
    submit = MagicMock(return_value={"url": "https://github.com/flathub/app/pull/1"})
    monkeypatch.setattr(batches, "submit_translation", submit)
    batches.publish_translation_batches()
    assert submit.call_args.args[4] == {name.id: "Beispiel", summary.id: "Aktuell"}
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.state == "submitted"
        assert batch.previous_translations == previous


def test_published_source_conflict_blocks_overwrite_until_recovery(
    batch_db, publishing_repo
):
    repo, _ = publishing_repo
    summary = unit(document(), "summary")
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Published"}, 42
    )
    batches.publish_translation_batches()
    pull = repo.pulls[1]
    metadata = repo.get_contents("", ref="a" * 40)[0]
    metadata.sha = "new-sha"
    metadata.decoded_content = XML.replace(b"Keep this comment", b"Updated comment")
    repo.get_branch.return_value.commit.sha = "b" * 40
    source, loaded, state, error, url, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert (source.revision, state, error) == ("a" * 40, "failed", "source_changed")
    assert unit(loaded, "summary").translation == "Published"
    assert url == pull.html_url
    with pytest.raises(MetadataError, match="source_changed"):
        batches.queue_translation(
            repo, APP_ID, "de", "b" * 40, {unit(document(), "name").id: "Name"}, 42
        )
    batches.rebase_translation(repo, APP_ID, "de", "a" * 40)
    _, loaded, state, error, _, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert (state, error) == ("queued", None)
    assert unit(loaded, "summary").translation == "Published"


@pytest.mark.parametrize("queued_edit", [False, True])
@pytest.mark.parametrize("unrelated_commit", [False, True])
def test_closed_pull_request_can_restart_without_losing_saved_fields(
    batch_db, publishing_repo, queued_edit, unrelated_commit
):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    name = unit(document(), "name")
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Published"}, 42
    )
    batches.publish_translation_batches()
    pull = repo.pulls[1]
    pull.state = "closed"
    _, loaded, state, error, _, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert (state, error) == ("failed", "pull_request_closed")
    assert unit(loaded, "summary").translation == "Published"
    if queued_edit:
        batches.queue_translation(
            repo, APP_ID, "de", "a" * 40, {name.id: "Queued name"}, 42
        )
        batches.publish_translation_batches()
    if unrelated_commit:
        repo.get_branch.return_value.commit.sha = "b" * 40
    source, _, _, _, _, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    batches.rebase_translation(repo, APP_ID, "de", source.revision)
    batches.rebase_translation(repo, APP_ID, "de", source.revision)
    _, loaded, state, error, _, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert (state, error) == ("queued", None)
    assert unit(loaded, "summary").translation == "Published"
    assert unit(loaded, "name").translation == (
        "Queued name" if queued_edit else name.translation
    )
    batches.publish_translation_batches()
    assert repo.create_pull.call_count == 2
    heads = [call.kwargs["head"] for call in repo.create_pull.call_args_list]
    assert heads[0] != heads[1]
    saved = repo.branches[heads[1]]
    assert unit(document(saved.decoded_content), "summary").translation == "Published"
    assert unit(document(saved.decoded_content), "name").translation == (
        "Queued name" if queued_edit else name.translation
    )
    assert pull.state == "closed"
    with batch_db() as db:
        assert db.query(MetadataTranslationBatch).one().generation == 1
    source, loaded, state, error, url, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert (state, error) == ("submitted", None)
    assert url.endswith("/2")
    assert unit(loaded, "summary").translation == "Published"
    batches.queue_translation(
        repo, APP_ID, "de", source.revision, {name.id: "Another save"}, 42
    )
    batches.publish_translation_batches()
    assert repo.create_pull.call_count == 2
    assert unit(document(saved.decoded_content), "summary").translation == "Published"


def test_recovery_clears_transient_publication_conflict(batch_db, publishing_repo):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    name = unit(document(), "name")
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Published"}, 42
    )
    batches.publish_translation_batches()
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Queued edit"}, 42
    )
    update = repo.update_file.side_effect
    repo.update_file.side_effect = GithubException(409, {"message": "Conflict"})
    batches.publish_translation_batches()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert (batch.state, batch.error) == ("failed", "source_changed")
        content, url, generation = batch.content, batch.url, batch.generation
    repo.update_file.side_effect = update
    batches.rebase_translation(repo, APP_ID, "de", "a" * 40)
    source, loaded, state, error, loaded_url, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert (state, error) == ("queued", None)
    assert unit(loaded, "summary").translation == "Queued edit"
    assert loaded_url == url
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.content == content
        assert batch.generation == generation
        assert batch.changes == {summary.id: "Queued edit"}
    batches.queue_translation(
        repo, APP_ID, "de", source.revision, {name.id: "Another edit"}, 42
    )
    batches.publish_translation_batches()
    assert unit(document(saved.decoded_content), "summary").translation == "Queued edit"
    assert unit(document(saved.decoded_content), "name").translation == "Another edit"
    repo.create_pull.assert_called_once()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert (batch.state, batch.error) == ("submitted", None)


@pytest.mark.parametrize("review_changed_translation", [False, True])
def test_merged_publication_does_not_restore_outdated_translations(
    batch_db, publishing_repo, review_changed_translation
):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    name = unit(document(), "name")
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Published"}, 42
    )
    batches.publish_translation_batches()
    pull = repo.pulls[1]
    pull.state = "closed"
    pull.merged = True
    pull.merge_commit_sha = "recorded-merge"
    merged = SimpleNamespace(
        decoded_content=(
            saved.decoded_content.replace(b"Published", b"Reviewed")
            if review_changed_translation
            else saved.decoded_content
        )
    )
    read_contents = repo.get_contents.side_effect
    repo.get_contents.side_effect = lambda path, ref: (
        merged if ref == "recorded-merge" else read_contents(path, ref)
    )
    metadata = repo.get_contents("", ref="a" * 40)[0]
    metadata.sha = "merged-sha"
    metadata.decoded_content = saved.decoded_content.replace(b"Published", b"Reviewed")
    repo.get_branch.return_value.commit.sha = "b" * 40
    source, loaded, _, error, url, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert error is None and url is None
    assert unit(loaded, "summary").translation == "Reviewed"
    batches.queue_translation(
        repo, APP_ID, "de", source.revision, {name.id: "Name"}, 42
    )
    _, loaded, _, error, _, previous = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert error is None
    assert unit(loaded, "summary").translation == "Reviewed"
    assert [item["translation"] for item in previous] == (
        ["Published"] if review_changed_translation else []
    )


@pytest.mark.parametrize("edit_summary", [False, True])
def test_recovery_preserves_merged_review_and_unpublished_edits(
    batch_db, publishing_repo, edit_summary
):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    name = unit(document(), "name")
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Published"}, 42
    )
    batches.publish_translation_batches()
    changes = {name.id: "Queued name"}
    if edit_summary:
        changes[summary.id] = "New edit"
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, changes, 42)
    pull = repo.pulls[1]
    pull.state = "closed"
    pull.merged = True
    metadata = repo.get_contents("", ref="a" * 40)[0]
    metadata.sha = "merged-sha"
    metadata.decoded_content = saved.decoded_content.replace(b"Published", b"Reviewed")
    repo.get_branch.return_value.commit.sha = "b" * 40
    batches.rebase_translation(repo, APP_ID, "de", "a" * 40)
    _, loaded, state, error, _, previous = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert (state, error) == ("queued", None)
    assert unit(loaded, "summary").translation == "Reviewed"
    assert unit(loaded, "name").translation == "Queued name"
    assert [item["translation"] for item in previous] == (
        ["New edit"] if edit_summary else ["Published"]
    )
    with batch_db() as db:
        assert db.query(MetadataTranslationBatch).one().changes == {
            name.id: "Queued name"
        }
    batches.publish_translation_batches()
    saved = repo.branches[repo.create_pull.call_args.kwargs["head"]]
    assert unit(document(saved.decoded_content), "summary").translation == "Reviewed"
    with batch_db() as db:
        assert db.query(MetadataTranslationBatch).one().state == "submitted"


@pytest.mark.parametrize("queued_edit", [False, True])
@pytest.mark.parametrize("published", [False, True])
@pytest.mark.parametrize(
    "conflict",
    [
        "source",
        "missing",
        "invalid",
        "wrong_component",
        "unsupported",
        "oversized",
        "directory",
    ],
)
def test_recovery_replaces_conflicting_open_branch(
    batch_db, publishing_repo, queued_edit, published, conflict
):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    name = unit(document(), "name")
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Published"}, 42
    )
    create = repo.create_pull.side_effect
    if not published:
        repo.create_pull.side_effect = GithubException(503, {"message": "Unavailable"})
    batches.publish_translation_batches()
    repo.create_pull.side_effect = create
    old_branch = repo.create_pull.call_args.kwargs["head"]
    old_pull = repo.pulls[1] if published else None
    if queued_edit:
        batches.queue_translation(
            repo, APP_ID, "de", "a" * 40, {name.id: "Queued name"}, 42
        )
    saved.decoded_content = saved.decoded_content.replace(
        b"Read &amp; write", b"PR source"
    )
    if conflict == "invalid":
        saved.decoded_content = b"<component>Unescaped & text</component>"
    elif conflict == "wrong_component":
        saved.decoded_content = saved.decoded_content.replace(
            APP_ID.encode(), b"org.example.Other"
        )
    elif conflict == "unsupported":
        saved.decoded_content = saved.decoded_content.replace(
            b"<description>", b'<description xml:lang="de">', 1
        )
    elif conflict == "oversized":
        saved.decoded_content = b"x" * (MAX_XML_BYTES + 1)
        saved.encoding = "none"
    conflicting_content = saved.decoded_content
    if published:
        repo.pin_head(old_branch)
    original_read = repo.get_contents.side_effect

    def get_contents(path, ref):
        if ref == old_branch or (old_pull and ref == old_pull.head.sha):
            if conflict == "missing":
                raise GithubException(404, {"message": "Not found"})
            if conflict == "directory":
                return []
        return original_read(path, ref)

    repo.get_contents.side_effect = get_contents
    batches.publish_translation_batches()
    if queued_edit or not published:
        with batch_db() as db:
            assert db.query(MetadataTranslationBatch).one().error == "source_changed"
    _, loaded, state, error, url, _ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert (state, error) == ("failed", "source_changed")
    assert unit(loaded, "summary").translation == "Published"
    assert url == (old_pull.html_url if published else None)
    batches.rebase_translation(repo, APP_ID, "de", "a" * 40)
    batches.rebase_translation(repo, APP_ID, "de", "a" * 40)
    _, loaded, state, error, _, previous = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    if published:
        unverifiable = queued_edit and conflict != "source"
        assert [item["translation"] for item in previous] == (
            ["Published", "Queued name"]
            if unverifiable
            else ["Published", "Published"]
            if conflict == "source"
            else ["Published"]
        )
        batches.queue_translation(
            repo, APP_ID, "de", "a" * 40, {summary.id: "Published"}, 42
        )
        _, loaded, state, error, _, _ = batches.read_saved_translation(
            repo, read_source(repo, APP_ID), APP_ID, "de"
        )
    assert (state, error) == ("queued", None)
    assert unit(loaded, "summary").translation == "Published"
    assert unit(loaded, "name").translation == (
        "Queued name"
        if queued_edit and (not published or conflict == "source")
        else name.translation
    )
    batches.publish_translation_batches()
    new_branch = repo.create_pull.call_args.kwargs["head"]
    assert new_branch != old_branch
    if published:
        assert old_pull.state == "closed"
    assert repo.branches[old_branch].decoded_content == conflicting_content
    assert (
        unit(document(repo.branches[new_branch].decoded_content), "summary").translation
        == "Published"
    )
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert (batch.state, batch.error, batch.generation) == ("submitted", None, 1)


@pytest.mark.parametrize("source_changed", [False, True])
@pytest.mark.parametrize("published_translation", ["Published summary", ""])
def test_rebase_preserves_published_contributions(
    batch_db, publishing_repo, source_changed, published_translation
):
    repo, _ = publishing_repo
    summary = unit(document(), "summary")
    name = unit(document(), "name")
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: published_translation}, 42
    )
    batches.publish_translation_batches()
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {name.id: "Queued name"}, 42
    )
    metadata = repo.get_contents("", ref="a" * 40)[0]
    metadata.sha = "new-sha"
    metadata.decoded_content = (
        XML.replace(b"Read &amp; write", b"New source")
        if source_changed
        else XML.replace(b"Keep this comment", b"Updated comment")
    )
    repo.get_branch.return_value.commit.sha = "b" * 40
    batches.rebase_translation(repo, APP_ID, "de", "a" * 40)
    _, loaded, state, error, _, previous = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert (state, error) == ("queued", None)
    assert unit(loaded, "name").translation == "Queued name"
    if source_changed:
        assert [(item["source"], item["translation"]) for item in previous] == [
            (summary.source, published_translation)
        ]
    else:
        assert unit(loaded, "summary").translation == published_translation
        assert previous == []
    batches.publish_translation_batches()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.state == "submitted"
        assert batch.previous_translations == previous


@pytest.mark.parametrize(
    "replacement",
    [
        b"",
        b"<summary>Changed</summary>",
        b"<summary>Read &amp; write</summary><summary>Read &amp; write</summary>",
    ],
)
def test_rebase_retains_removed_changed_and_ambiguous_fields(replacement):
    old = document()
    summary = unit(old, "summary")
    current = document(XML.replace(b"<summary>Read &amp; write</summary>", replacement))
    result = reconcile(old, current, {summary.id: "Neu"})
    assert result.apply == {}
    assert [(item.source, item.translation) for item in result.retain] == [
        (summary.source, "Neu")
    ]


@pytest.mark.parametrize(
    "current,decision",
    [("PR base", "apply"), ("Draft", "satisfied"), ("Maintainer", "retain")],
)
def test_reconcile_against_text_seen_on_pr(current, decision):
    old = document()
    summary = unit(old, "summary")
    head = document(old.apply({summary.id: current}))
    result = reconcile(
        document(), head, {summary.id: "Draft"}, expected={summary.id: "PR base"}
    )
    assert result.apply == (
        {unit(head, "summary").id: "Draft"} if decision == "apply" else {}
    )
    assert result.satisfied == ({summary.id} if decision == "satisfied" else set())
    assert [u.translation for u in result.retain] == (
        ["Draft"] if decision == "retain" else []
    )


def test_reconciliation_only_uses_duplicate_field_ids_when_anchored():
    xml = XML.replace(
        b"<name>Example</name>", b"<name>Example</name><name>Example</name>"
    )
    old = document(xml)
    key = unit(old, "name").id
    draft = {key: "Beispiel"}
    assert reconcile(old, old.with_pending(xml), draft).apply == draft
    result = reconcile(old, document(xml), draft)
    assert not result.apply and [u.id for u in result.retain] == [key]


def test_rebase_with_no_matching_fields_keeps_saved_text_on_reload(batch_db):
    repo, _ = saving_repo()
    summary = unit(document(), "summary")
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Neu"}, 42)
    metadata = repo.get_contents("", ref="a" * 40)[0]
    metadata.sha = "new-sha"
    metadata.decoded_content = XML.replace(b"Read &amp; write", b"New source")
    repo.get_branch.return_value.commit.sha = "b" * 40
    batches.rebase_translation(repo, APP_ID, "de", "a" * 40)
    source, loaded, _, error, _, previous = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert error is None
    assert unit(loaded, "summary").source == "New source"
    assert previous[0]["translation"] == "Neu"
    batches.queue_translation(
        repo, APP_ID, "de", source.revision, {unit(loaded, "summary").id: "Aktuell"}, 42
    )
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.previous_translations == previous
        assert batch.changes == {summary.id: "Aktuell"}


@pytest.mark.parametrize("field", ["summary", "keywords", "description"])
@pytest.mark.parametrize("character", ["\x00", "\x0b", "\ud800", "\ufffe", "\uffff"])
def test_invalid_xml_characters_preserve_saved_batch(batch_db, field, character):
    repo, _ = saving_repo()
    summary = unit(document(), "summary")
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Saved"}, 42)
    with batch_db() as db:
        saved_content = db.query(MetadataTranslationBatch).one().content
    target = unit(document(), field)
    with pytest.raises(MetadataError, match="invalid_characters"):
        batches.queue_translation(
            repo, APP_ID, "de", "a" * 40, {target.id: f"Invalid{character}text"}, 42
        )
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.content == saved_content
        assert batch.changes == {summary.id: "Saved"}


def test_serialized_xml_at_size_limit_can_reload():
    changes = {unit(document(), "summary").id: "x" * 50}
    output_size = len(document().apply(changes))
    content = XML.replace(
        b"Keep this comment",
        b"Keep this comment" + b"x" * (MAX_XML_BYTES - output_size),
    )
    output = document(content).apply(changes)
    assert len(output) == MAX_XML_BYTES
    assert (
        unit(document(content).with_pending(output), "summary").translation == "x" * 50
    )


def test_batch_retry_after_lost_response_reuses_github_commit(
    batch_db, monkeypatch, publishing_repo
):
    repo, _ = publishing_repo
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {unit(document(), "summary").id: "Neu"}, 42
    )

    def lost_response(*args, **kwargs):
        submit_translation(*args, **kwargs)
        raise GithubException(502, {"message": "response lost"})

    monkeypatch.setattr(batches, "submit_translation", lost_response)
    batches.publish_translation_batches()
    monkeypatch.setattr(batches, "submit_translation", submit_translation)
    batches.publish_translation_batches()
    repo.update_file.assert_called_once()
    repo.create_pull.assert_called_once()
    with batch_db() as db:
        assert db.query(MetadataTranslationBatch).one().state == "submitted"


@pytest.mark.parametrize("merged", [False, True])
@pytest.mark.parametrize("reset", [False, True])
def test_lost_pr_response_keeps_link_after_closure(
    batch_db, publishing_repo, merged, reset
):
    repo, saved = publishing_repo
    key = unit(document(), "summary").id
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {key: "Draft"}, 42)
    create = repo.create_pull.side_effect

    def lose_response(**kwargs):
        create(**kwargs)
        if reset:
            raise ConnectionResetError("connection lost after create")
        raise GithubException(502, {"message": "lost response"})

    repo.create_pull.side_effect = lose_response
    if reset:
        with pytest.raises(ConnectionResetError):
            batches.publish_translation_batches()
    else:
        batches.publish_translation_batches()
    pull = repo.pulls[1]
    pull.state, pull.merged = "closed", merged
    if merged:
        metadata = repo.get_contents("", ref="a" * 40)[0]
        metadata.sha, metadata.decoded_content = "merged", saved.decoded_content
    batches.publish_translation_batches()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        if merged:
            assert batch.state == "submitted" and not batch.changes
        else:
            assert batch.url == pull.html_url and batch.changes == {key: "Draft"}
    repo.create_pull.assert_called_once()


def test_unpublished_conflict_does_not_count_as_translated(batch_db, publishing_repo):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Draft"}, 42)
    create = repo.create_pull.side_effect
    repo.create_pull.side_effect = GithubException(503, {"message": "unavailable"})
    batches.publish_translation_batches()
    saved.decoded_content = saved.decoded_content.replace(
        b">Draft</summary>", b">Reviewed</summary>"
    )
    repo.create_pull.side_effect = create
    batches.publish_translation_batches()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.url is None and batch.missing_texts is None
        assert batch.source_content is None and batch.content is None
        assert {u["translation"] for u in batch.previous_translations} == {
            "Draft",
            "Reviewed",
        }
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Resolved"}, 42
    )
    batches.publish_translation_batches()
    assert repo.pulls[1].state == "open"
    assert unit(document(saved.decoded_content), "summary").translation == "Reviewed"


def test_publisher_retains_contested_draft_and_sends_independent_fields(
    batch_db, publishing_repo
):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    name = unit(document(), "name")
    caption = unit(document(), "caption")
    batches.queue_translation(
        repo,
        APP_ID,
        "de",
        "a" * 40,
        {summary.id: "First", caption.id: "Published caption"},
        42,
    )
    batches.publish_translation_batches()
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Draft", name.id: "Name"}, 42
    )
    saved.decoded_content = saved.decoded_content.replace(
        b"First</summary>", b"Reviewed</summary>"
    ).replace(b"Published caption</caption>", b"Reviewed caption</caption>")
    batches.publish_translation_batches()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert {i["translation"] for i in batch.previous_translations} == {
            "Draft",
            "Published caption",
        }
        assert batch.changes == {name.id: "Name"}
    batches.publish_translation_batches()
    assert unit(document(saved.decoded_content), "summary").translation == "Reviewed"
    assert unit(document(saved.decoded_content), "name").translation == "Name"


def test_rebase_preserves_reviewed_open_pr_text_and_competing_draft(
    batch_db, publishing_repo
):
    repo, saved = publishing_repo
    summary = unit(document(), "summary")
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Published"}, 42
    )
    batches.publish_translation_batches()
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Draft"}, 42)
    saved.decoded_content = saved.decoded_content.replace(b"Published", b"Reviewed")
    reviewed = document(saved.decoded_content)
    saved.decoded_content = reviewed.apply({unit(reviewed, "keywords").id: ""})
    saved.decoded_content = saved.decoded_content.replace(
        b"<name>Example</name>", b"<name>New name</name>"
    )
    metadata = repo.get_contents("", ref="a" * 40)[0]
    metadata.sha = "new"
    repo.pin_head(repo.create_pull.call_args.kwargs["head"])
    metadata.decoded_content = XML.replace(b"Keep this comment", b"Changed comment")
    batches.rebase_translation(repo, APP_ID, "de", "a" * 40)
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert not batch.changes
        assert {
            (item["field"], item["translation"]) for item in batch.previous_translations
        } == {("summary", "Reviewed"), ("summary", "Draft"), ("keywords", "")}
    assert unit(document(saved.decoded_content), "summary").translation == "Reviewed"


def test_save_across_unrelated_commit_checks_metadata_blob(batch_db):
    repo, _ = saving_repo()
    repo.get_branch.return_value.commit.sha = "b" * 40
    summary = unit(document(), "summary")
    batches.queue_translation(
        repo, APP_ID, "de", "a" * 40, {summary.id: "Translated"}, 42
    )
    read = repo.get_contents.side_effect
    repo.get_contents.side_effect = lambda path, ref: (
        SimpleNamespace(sha="different") if ref == "a" * 40 else read(path, ref)
    )
    with pytest.raises(MetadataError, match="source_changed"):
        batches.queue_translation(
            repo, APP_ID, "de", "a" * 40, {summary.id: "Draft"}, 42
        )


def test_reload_requeues_edits_when_pr_reopens(batch_db, publishing_repo):
    repo, saved = publishing_repo
    key = unit(document(), "summary").id
    for value in ["First", "Draft"]:
        batches.queue_translation(repo, APP_ID, "de", "a" * 40, {key: value}, 42)
        if value == "First":
            batches.publish_translation_batches()
    pull = repo.pulls[1]
    pull.state = "closed"
    batches.publish_translation_batches()
    pull.state = "open"
    _, _, state, error, *_ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert (state, error) == ("queued", None)
    batches.publish_translation_batches()
    assert unit(document(saved.decoded_content), "summary").translation == "Draft"


def test_review_reload_uses_one_pr_lookup_outside_the_writer(
    batch_db, publishing_repo, monkeypatch
):
    repo, saved = publishing_repo
    metadata = repo.get_contents("", ref="a" * 40)[0]
    metadata.decoded_content = XML.replace(
        b"<p>Second paragraph.</p>", b"<p>Repeated</p><p>Repeated</p>"
    )
    saved.decoded_content = metadata.decoded_content
    field = next(
        u for u in document(metadata.decoded_content).units() if u.source == "Repeated"
    )
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {field.id: "Draft"}, 42)
    batches.publish_translation_batches()
    summary = unit(document(saved.decoded_content), "summary")
    saved.decoded_content = document(saved.decoded_content).apply(
        {summary.id: "Reviewed"}
    )
    in_transaction = False

    @contextmanager
    def writer(kind):
        nonlocal in_transaction
        with batch_db(kind) as db:
            in_transaction = True
            yield db
            in_transaction = False

    monkeypatch.setattr(batches, "get_db", writer)

    def get_pull(number):
        assert not in_transaction
        return repo.pulls[number]

    repo.get_pull.side_effect = get_pull
    repo.get_pull.reset_mock()
    _, _, _, _, _, history = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    repo.get_pull.assert_called_once_with(1)
    assert history == []
    repo.get_pull.side_effect = repo.pulls.__getitem__
    pull = repo.pulls[1]
    pull.state = "closed"
    batches.rebase_translation(repo, APP_ID, "de", "a" * 40)
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.changes[field.id] == "Draft"
        assert not any(
            item["translation"] == "Draft" for item in batch.previous_translations
        )


def test_review_removing_last_text_reopens_queue_and_survives_branch_deletion(
    batch_db, publishing_repo
):
    repo, saved = publishing_repo
    original = document()
    fields = {
        u.id: ("Wort" if u.field != "description" else u.source)
        for u in original.units()
    }
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, fields, 42)
    batches.publish_translation_batches()
    pull = repo.pulls[1]
    summary = unit(original, "summary")
    head = original.with_pending(saved.decoded_content)
    saved.decoded_content = head.apply({summary.id: ""})
    branch = repo.create_pull.call_args.kwargs["head"]
    repo.pin_head(branch)
    batches.prune_translation_snapshots()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.missing_texts == 1
        assert any(
            u["id"] == summary.id and u["translation"] == "Wort"
            for u in batch.previous_translations
        )
    saved.decoded_content = original.with_pending(saved.decoded_content).apply(
        {summary.id: "Reviewed"}
    )
    pull.state = "closed"
    repo.pin_head(branch)
    del repo.branches[repo.create_pull.call_args.kwargs["head"]]
    batches.rebase_translation(repo, APP_ID, "de", "a" * 40)
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert {"Reviewed", "Wort"} <= {
            u["translation"] for u in batch.previous_translations
        }


def test_batch_reverted_before_publication_does_not_stay_failed(
    batch_db, publishing_repo
):
    repo, _ = publishing_repo
    summary = unit(document(), "summary")
    for value in ("Neu", summary.translation):
        batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: value}, 42)
    batches.publish_translation_batches()
    repo.update_file.assert_not_called()
    repo.create_git_ref.assert_not_called()
    repo.create_pull.assert_not_called()
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert batch.changes == {}
        assert batch.error is None
        assert batch.source_content is None and batch.content is None
    _, restored, *_ = batches.read_saved_translation(
        repo, read_source(repo, APP_ID), APP_ID, "de"
    )
    assert unit(restored, "summary").translation == summary.translation
    batches.queue_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Again"}, 42)


def test_locale_variants_share_a_batch_and_pr(batch_db, publishing_repo):
    repo, _ = publishing_repo
    key = unit(document(), "summary").id
    for locale, value in [("ca-ES-valencia", "A"), ("ca_ES_VALENCIA", "B")]:
        batches.queue_translation(repo, APP_ID, locale, "a" * 40, {key: value}, 42)
        batches.publish_translation_batches()
    with batch_db() as db:
        assert db.query(MetadataTranslationBatch).one().locale == "ca_ES_valencia"
    repo.create_pull.assert_called_once()


def test_bare_install_destination_requires_existing_directory():
    name = f"{APP_ID}.metainfo.xml"
    commands = [f"install -Dm644 {name} /app/share/metainfo"]
    module = {
        "buildsystem": "simple",
        "sources": [{"type": "file", "path": name}],
        "build-commands": commands,
    }
    assert not _owns_metadata({"modules": [module]}, name, APP_ID)
    commands.insert(0, "mkdir -p /app/share/metainfo")
    assert _owns_metadata({"modules": [module]}, name, APP_ID)

    module["sources"].append({"type": "shell", "commands": [commands.pop(0)]})
    assert _owns_metadata({"modules": [module]}, name, APP_ID)
    module["sources"][-1]["commands"], module["build-commands"] = (
        module["build-commands"],
        module["sources"][-1]["commands"],
    )
    assert not _owns_metadata({"modules": [module]}, name, APP_ID)


def test_local_metainfo_and_desktop_install():
    name = f"{APP_ID}.metainfo.xml"
    desktop = f"{APP_ID}.desktop"
    module = {
        "buildsystem": "simple",
        "sources": [{"type": "file", "path": p} for p in (name, desktop)],
        "build-commands": [
            f"install -Dm644 {name} /app/share/metainfo/",
            f"install -Dm644 {desktop} /app/share/applications/{desktop}",
        ],
    }
    assert _owns_metadata({"modules": [module]}, name, APP_ID)
    sibling = {
        "buildsystem": "simple",
        "sources": [module["sources"].pop()],
        "build-commands": [module["build-commands"].pop()],
    }
    assert _owns_metadata({"modules": [module, sibling]}, name, APP_ID)
    sibling["build-commands"][-1] += f"; rm /app/share/metainfo/{name}"
    assert not _owns_metadata({"modules": [module, sibling]}, name, APP_ID)


def document(content=XML, locale="de"):
    return MetadataDocument(content, APP_ID, locale)


def unit(doc, field):
    return next(unit for unit in doc.units() if unit.field == field)


def test_all_translatable_fields_and_exclusions():
    doc = document()
    assert {u.field for u in doc.units()} == {
        "name",
        "name_variant_suffix",
        "developer_name",
        "summary",
        "description",
        "keywords",
        "caption",
        "release",
        "agreement",
    }
    assert doc.units()[0].field == "summary"
    assert unit(doc, "summary").source == "Read & write"
    assert unit(doc, "summary").translation == "Lesen und schreiben"
    assert unit(doc, "keywords").translation == "Editor\nText"
    assert unit(doc, "release").context == "1.0"
    assert not any("Do not translate" in u.source for u in doc.units())


@pytest.mark.parametrize(
    "latest_notes", [b"<description><p>Latest</p></description>", b""]
)
def test_only_latest_release_notes_are_translatable(latest_notes):
    xml = XML.replace(
        b"<releases>",
        b'<releases><release version="3.0" type="development">'
        b"<description><p>Preview</p></description></release>"
        b'<release version="2.0" type="stable">' + latest_notes + b"</release>",
    )
    notes = [u.source for u in document(xml).units() if u.field == "release"]
    assert notes == (["Latest"] if latest_notes else [])


def test_only_requested_locale_and_units_change():
    doc = document()
    output = doc.apply({unit(doc, "summary").id: "Texte lesen und schreiben"})
    root = etree.fromstring(output)
    assert root.find(f"summary[@{LANG}='de']").text == "Texte lesen und schreiben"
    assert root.find(f"summary[@{LANG}='fr']").text == "Lire et écrire"
    assert root.find("summary").text == "Read & write"
    assert b"Keep this comment" in output
    original = etree.fromstring(XML)
    original.find(f"summary[@{LANG}='de']").text = "Texte lesen und schreiben"
    assert etree.tostring(root) == etree.tostring(original)


def test_add_region_locale_and_read_it_back():
    doc = document(locale="pt-BR")
    output = doc.apply({unit(doc, "summary").id: "Ler e escrever"})
    assert unit(document(output, "pt_BR"), "summary").translation == "Ler e escrever"


def test_locale_alias_updates_existing_translation_instead_of_duplicating():
    source = XML.replace(b'xml:lang="de"', b'xml:lang="pt-BR"')
    doc = document(source, "pt_br")
    output = doc.apply({unit(doc, "summary").id: "Ler e escrever"})
    root = etree.fromstring(output)
    assert root.find(f"summary[@{LANG}='pt_BR']").text == "Ler e escrever"
    assert root.find(f"summary[@{LANG}='pt-BR']") is None
    assert len(root.findall("summary")) == 3


def test_deleting_translation_preserves_original_and_other_locales():
    doc = document()
    output = doc.apply({unit(doc, "summary").id: ""})
    root = etree.fromstring(output)
    assert root.find(f"summary[@{LANG}='de']") is None
    assert root.find(f"summary[@{LANG}='fr']") is not None
    assert root.find("summary").text == "Read & write"


def test_description_markup_and_keywords_roundtrip():
    doc = document()
    output = doc.apply(
        {
            unit(
                doc, "description"
            ).id: "Nutze <em>Example</em> mit <code>{name}</code>.",
            unit(doc, "keywords").id: "Schreiben\nDokumente",
        }
    )
    updated = document(output)
    assert unit(updated, "description").translation == (
        "Nutze <em>Example</em> mit <code>{name}</code>."
    )
    assert unit(updated, "keywords").translation == "Schreiben\nDokumente"
    assert len(etree.fromstring(output).findall("keywords")) == 2


@pytest.mark.parametrize(
    "value",
    [
        "<script>alert(1)</script>",
        '<em onclick="bad()">Text</em>',
        "<em>Unclosed",
        "<code>{different}</code>",
        "<code>{name}<em> --unsafe</em></code>",
        "<!-- comment -->",
        '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]>&x;',
    ],
)
def test_invalid_markup_and_changed_code_rejected(value):
    doc = document()
    with pytest.raises(MetadataError):
        doc.apply({unit(doc, "description").id: value})


def test_nested_source_code_preserves_all_text():
    doc = document(XML.replace(b"<code>{name}</code>", b"<code>{<em>name</em>}</code>"))
    output = doc.apply({unit(doc, "description").id: "Nutze <code>{name}</code>."})
    assert unit(document(output), "description").translation == (
        "Nutze <code>{name}</code>."
    )


def test_plain_fields_escape_xml():
    doc = document()
    output = doc.apply({unit(doc, "summary").id: '<script> & "text"'})
    root = etree.fromstring(output)
    assert root.find(f"summary[@{LANG}='de']").text == '<script> & "text"'
    assert not root.findall(".//script")


@pytest.mark.parametrize("locale", ["en", "en_US", "../../de", "de<script>", ""])
def test_invalid_or_source_locale_rejected(locale):
    with pytest.raises(MetadataError):
        document(locale=locale)


def test_unknown_unit_and_noop_rejected():
    doc = document()
    with pytest.raises(MetadataError, match="invalid_units"):
        doc.apply({"/component/project_license": "MIT"})
    with pytest.raises(MetadataError, match="no_changes"):
        doc.apply({unit(doc, "summary").id: "Lesen und schreiben"})


@pytest.mark.parametrize("component_type", ["desktop", "desktop-application"])
def test_legacy_desktop_id_indexes_and_preserves_listing_identity(component_type):
    xml = f"""<component type="{component_type}"><id>{APP_ID}.desktop</id>
    <metadata_license>CC0</metadata_license><summary>Hello</summary></component>""".encode()
    assert MetadataDocument(xml, APP_ID, None).missing_counts()["*"] == 1
    doc = MetadataDocument(xml, APP_ID, "de")
    saved = etree.fromstring(doc.apply({unit(doc, "summary").id: "Hallo"}))
    assert saved.findtext("id") == f"{APP_ID}.desktop"
    with pytest.raises(MetadataError, match="wrong_component"):
        MetadataDocument(xml, "org.example.Other", "de")


def test_localized_keyword_children_do_not_block_other_listing_fields():
    keywords = b"""<keywords><keyword>Database</keyword>
    <keyword xml:lang="de">Datenbank</keyword><keyword translate="no">SQL</keyword></keywords>"""
    xml = (
        f"<component><id>{APP_ID}</id><metadata_license>CC0</metadata_license>".encode()
        + keywords
        + b"<summary>Hello</summary></component>"
    )
    assert MetadataDocument(xml, APP_ID, None).missing_counts()["*"] == 1
    doc = MetadataDocument(xml, APP_ID, "de")
    assert [u.field for u in doc.units()] == ["summary"]
    assert keywords in doc.apply({unit(doc, "summary").id: "Hallo"})


def test_xml_external_entities_and_wrong_component_rejected():
    with pytest.raises(MetadataError):
        document(
            b'<!DOCTYPE component [<!ENTITY x SYSTEM "file:///etc/passwd">]><component/>'
        )
    with pytest.raises(MetadataError, match="wrong_component"):
        document(XML.replace(APP_ID.encode(), b"org.example.Other"))


def test_grouped_existing_translations_are_matched_in_source_order():
    xml = XML.replace(
        b'<p xml:lang="de">Verwende <em>Example</em> mit <code>{name}</code>.</p>', b""
    ).replace(
        b'<p translate="no">Do not translate.</p>',
        b'<p translate="no">Do not translate.</p>'
        b'<p xml:lang="de">Eins</p><p xml:lang="de">Zwei</p><p xml:lang="de">Drei</p>',
    )
    doc = document(xml)
    paragraphs = [u for u in doc.units() if u.field == "description" and "/p" in u.id]
    assert [u.translation for u in paragraphs] == ["Eins", "Zwei"]


@pytest.mark.parametrize("deleted", [0, 1])
def test_grouped_delete_reload_and_save_preserves_other_fields(deleted):
    xml = f"""<component><id>{APP_ID}</id>
<description><p>First</p><p>Second</p>
<p xml:lang="de">Erste</p><p xml:lang="de">Zweite</p>
<p xml:lang="fr">Premiere</p><p xml:lang="fr">Deuxieme</p>
</description></component>""".encode()
    doc = document(xml)
    paragraphs = doc.units()
    output = doc.apply({paragraphs[deleted].id: ""})
    loaded = document(xml).with_pending(output)
    expected = ["Erste", "Zweite"]
    expected[deleted] = ""
    assert [item.translation for item in loaded.units()] == expected
    output = loaded.apply({paragraphs[deleted].id: "Neu"})
    expected[deleted] = "Neu"
    assert [item.translation for item in document(output).units()] == expected
    assert [item.translation for item in document(output, "fr").units()] == [
        "Premiere",
        "Deuxieme",
    ]


def test_grouped_delete_preserves_protected_sibling_association():
    xml = f"""<component><id>{APP_ID}</id><description>
<p>First</p><p>Second</p>
<p xml:lang="de" translate="no">Protected</p><p xml:lang="de">Zweite</p>
</description></component>""".encode()
    doc = document(xml)
    output = doc.apply({doc.units()[0].id: ""})
    loaded = document(xml).with_pending(output)
    assert [(item.source, item.translation) for item in loaded.units()] == [
        ("Second", "")
    ]
    assert b'<p xml:lang="de" translate="no">Protected</p>' in output


@pytest.mark.parametrize(
    ("original", "protected", "field"),
    [
        (
            b'<p xml:lang="de">Verwende <em>Example</em>',
            b'<p xml:lang="de">Verwende <em translate="no">Example</em>',
            "description",
        ),
        (
            b'<keywords xml:lang="de"><keyword>Editor</keyword>',
            b'<keywords xml:lang="de"><keyword translate="no">Editor</keyword>',
            "keywords",
        ),
    ],
)
def test_localized_descendant_exclusions_are_not_editable(original, protected, field):
    original_id = unit(document(), field).id
    content = XML.replace(original, protected)
    doc = document(content)
    assert original_id not in {item.id for item in doc.units()}
    with pytest.raises(MetadataError, match="invalid_units"):
        doc.apply({original_id: "Replacement"})
    output = doc.apply({unit(doc, "summary").id: "Neu"})
    assert protected in output


def test_discovery_rejects_upstream_and_generated_metadata():
    repo = fake_repo()
    manifest = repo.get_contents("", ref="a" * 40)[1]
    manifest.decoded_content = f"""modules:
  - name: upstream
    buildsystem: simple
    sources:
      - type: archive
        url: https://example.org/source.tar.gz
    build-commands:
      - python3 generate_metadata.py > {APP_ID}.metainfo.xml
      - install -Dm644 {APP_ID}.metainfo.xml /app/share/metainfo/
""".encode()
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)


@pytest.mark.parametrize(
    ("options", "source", "expected"),
    [
        ({"subdir": "build"}, "../", True),
        ({"buildsystem": "meson"}, "../", True),
        ({"buildsystem": "cmake", "builddir": True}, "../", True),
        ({"subdir": "src/lib", "buildsystem": "meson"}, "../../../", True),
        ({"only-arches": ["aarch64", "x86_64"]}, "", True),
        ({"only-arches": ["aarch64"]}, "", False),
        ({"subdir": "build"}, "", False),
        ({"subdir": "build"}, "../../", False),
        ({}, "app/data/", False),
    ],
)
def test_discovery_matches_recipe_source_from_build_directory(
    options, source, expected
):
    repo = fake_repo()
    manifest = repo.get_contents("", ref="a" * 40)[1]
    module = yaml.safe_load(manifest.decoded_content)
    del module["build-commands"]
    module.update(options)
    module["post-install"] = [
        f"install -Dm644 {source}{APP_ID}.metainfo.xml -t /app/share/metainfo"
    ]
    manifest.decoded_content = yaml.safe_dump({"modules": [module]}).encode()
    if expected:
        assert read_source(repo, APP_ID).content == XML
    else:
        with pytest.raises(MetadataError, match="unsupported_metadata"):
            read_source(repo, APP_ID)


def test_discovery_does_not_borrow_file_source_from_another_module():
    repo = fake_repo()
    manifest = repo.get_contents("", ref="a" * 40)[1]
    manifest.decoded_content = f"""modules:
  - name: unused
    buildsystem: simple
    sources:
      - type: file
        path: {APP_ID}.metainfo.xml
  - name: upstream
    buildsystem: simple
    sources:
      - type: git
        url: https://example.org/source.git
    build-commands:
      - install -Dm644 {APP_ID}.metainfo.xml /app/share/metainfo/
""".encode()
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)


@pytest.mark.parametrize(
    "command",
    [
        f"install -Dm644 data/generated.xml /app/share/metainfo/{APP_ID}.metainfo.xml",
        f"cp data/{APP_ID}.metainfo.xml /app/share/metainfo/",
        f"mv -t /app/share/metainfo data/{APP_ID}.metainfo.xml",
        f'cp data/generated.xml "${{FLATPAK_DEST}}/share/metainfo/{APP_ID}.metainfo.xml"',
        f"cp data/generated.xml /app/share/metainfo/{APP_ID}.metainfo.xml && echo done",
        f"install -Dm644 data/generated.xml /app/share/./metainfo/{APP_ID}.metainfo.xml",
        f"cp data/generated.xml /app/share//metainfo/{APP_ID}.metainfo.xml",
        f"cp data/generated.xml /app/lib/../share/metainfo/{APP_ID}.metainfo.xml",
        f"cp data/generated.xml /app/share/./metainfo/{APP_ID}.metainfo.xml && echo done",
    ],
)
@pytest.mark.parametrize("upstream_first", [False, True])
def test_discovery_rejects_competing_metadata_install(command, upstream_first):
    repo = fake_repo()
    manifest = repo.get_contents("", ref="a" * 40)[1]
    local = yaml.safe_load(manifest.decoded_content)
    upstream = {
        "name": "upstream",
        "buildsystem": "simple",
        "sources": [{"type": "archive", "url": "https://example.org/source.tar.gz"}],
        "build-commands": [command],
    }
    modules = [upstream, local] if upstream_first else [local, upstream]
    manifest.decoded_content = yaml.safe_dump({"modules": modules}).encode()
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)


def test_discovery_allows_unrelated_metadata_destinations():
    repo = fake_repo()
    manifest = repo.get_contents("", ref="a" * 40)[1]
    local = yaml.safe_load(manifest.decoded_content)
    upstream = {
        "name": "dependency",
        "buildsystem": "simple",
        "sources": [{"type": "archive", "url": "https://example.org/source.tar.gz"}],
        "build-commands": [
            "install -Dm644 data/dependency.xml /app/share/metainfo/dependency.xml"
        ],
    }
    manifest.decoded_content = yaml.safe_dump({"modules": [local, upstream]}).encode()
    assert read_source(repo, APP_ID).content == XML


def fake_repo():
    repo = MagicMock()
    repo.archived = repo.private = False
    repo.default_branch = "master"
    repo.owner.login = "flathub"
    repo.get_branch.return_value.commit.sha = "a" * 40
    metadata = SimpleNamespace(
        name=f"{APP_ID}.metainfo.xml",
        path=f"{APP_ID}.metainfo.xml",
        type="file",
        size=len(XML),
        sha="file-sha",
        decoded_content=XML,
    )
    manifest = SimpleNamespace(
        name=f"{APP_ID}.yml",
        path=f"{APP_ID}.yml",
        type="file",
        size=200,
        decoded_content=(
            f"buildsystem: simple\nsources:\n  - type: file\n"
            f"    path: {APP_ID}.metainfo.xml\n"
            f"build-commands:\n  - install -Dm644 {APP_ID}.metainfo.xml "
            f"/app/share/metainfo/{APP_ID}.metainfo.xml\n"
        ).encode(),
    )

    def read(path, ref):
        if ref in {"a" * 40, repo.get_branch.return_value.commit.sha}:
            if not path:
                return [metadata, manifest]
            for file in (metadata, manifest):
                if path == file.path:
                    return file
        raise GithubException(404, {"message": "Not found"})

    repo.get_contents.side_effect = read
    repo.get_pulls.return_value = []
    repo.get_git_ref.side_effect = GithubException(404, {"message": "Not found"})
    repo.create_pull.return_value = SimpleNamespace(
        html_url="https://github.com/flathub/org.example.App/pull/1", state="open"
    )
    return repo


def test_discovery_pins_reads_and_requires_direct_install():
    repo = fake_repo()
    source = read_source(repo, APP_ID)
    assert source.revision == "a" * 40
    assert source.content == XML
    for call in repo.get_contents.call_args_list:
        assert call.kwargs["ref"] == "a" * 40
    repo.get_contents("", ref=source.revision)[1].decoded_content = b"meson setup"
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)


def test_nested_listing_uses_the_declared_path_and_staged_basename():
    repo = fake_repo()
    xml, manifest = repo.get_contents("", ref="a" * 40)
    xml.path = f"data/{xml.name}"
    manifest.decoded_content = manifest.decoded_content.replace(
        f"path: {xml.name}".encode(), f"path: {xml.path}".encode()
    )
    directory = SimpleNamespace(type="dir", name="data")

    def read(path, ref):
        assert ref == "a" * 40
        return {
            "": [directory, manifest],
            "data": [xml],
            xml.path: xml,
            manifest.path: manifest,
        }[path]

    repo.get_contents.side_effect = read
    assert read_source(repo, APP_ID).path == xml.path
    manifest.decoded_content = manifest.decoded_content.replace(
        f"install -Dm644 {xml.name}".encode(),
        f"install -Dm644 app/data/{xml.name}".encode(),
    )
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)


def test_discovery_checks_external_dependencies_at_same_revision():
    repo = fake_repo()
    entries = repo.get_contents("", ref="a" * 40)
    module = yaml.safe_load(entries[1].decoded_content)
    entries[1].decoded_content = yaml.safe_dump(
        {"modules": ["deps/zlib.json", module]}
    ).encode()
    read = repo.get_contents.side_effect
    dependency = SimpleNamespace(
        type="file", size=30, decoded_content=b'{"name":"zlib","buildsystem":"cmake"}'
    )
    repo.get_contents.side_effect = lambda path, ref: (
        dependency if path == "deps/zlib.json" else read(path, ref)
    )
    assert read_source(repo, APP_ID).content == XML
    repo.get_contents.assert_any_call("deps/zlib.json", ref="a" * 40)


def test_discovery_allows_a_dedicated_listing_module_to_install_its_assets():
    repo = fake_repo()
    manifest = repo.get_contents("", ref="a" * 40)[1]
    module = yaml.safe_load(manifest.decoded_content)
    installs = [
        (f"{APP_ID}.desktop", "/app/share/applications/"),
        (f"{APP_ID}.png", "/app/share/icons/hicolor/256x256/apps/"),
    ]
    for filename, target in installs:
        module["sources"].append({"type": "file", "path": filename})
        module["build-commands"].insert(0, f"install -D -t {target} {filename}")
    manifest.decoded_content = yaml.safe_dump({"modules": [module]}).encode()
    assert read_source(repo, APP_ID).content == XML

    module["build-commands"][0] += f"; rm {APP_ID}.metainfo.xml"
    manifest.decoded_content = yaml.safe_dump({"modules": [module]}).encode()
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)


@pytest.mark.parametrize(
    ("buildsystem", "section", "dependency"),
    [
        (
            "autotools",
            "post-install",
            {"type": "archive", "url": "https://example.org/app.tar.gz"},
        ),
        ("simple", "build-commands", {"type": "extra-data", "filename": "app.deb"}),
        (
            "simple",
            "build-commands",
            {"type": "file", "url": "https://example.org/app.deb"},
        ),
        ("qmake", "shell", {"type": "git", "url": "https://example.org/app.git"}),
    ],
)
def test_mixed_build_discovers_recipe_owned_listing(buildsystem, section, dependency):
    repo = fake_repo()
    manifest = repo.get_contents("", ref="a" * 40)[1]
    local = yaml.safe_load(manifest.decoded_content)
    commands = ["install -Dm755 app /app/bin/app", *local.pop("build-commands")]
    local["buildsystem"] = buildsystem
    local["sources"].insert(0, dependency)
    if section == "shell":
        local["sources"].append({"type": "shell", "commands": commands})
    else:
        local[section] = commands
    manifest.decoded_content = yaml.safe_dump({"modules": [local]}).encode()
    assert read_source(repo, APP_ID).content == XML


def test_mixed_build_checks_pinned_patches_and_included_sources():
    repo = fake_repo()
    revision = "a" * 40
    manifest = repo.get_contents("", ref=revision)[1]
    module = yaml.safe_load(manifest.decoded_content)
    module["sources"] += [
        {"type": "patch", "path": "build.patch"},
        "vendor.json",
    ]
    manifest.decoded_content = yaml.safe_dump({"modules": [module]}).encode()
    files = {
        "build.patch": b"--- a/main.c\n+++ b/main.c",
        "vendor.json": b'[{"type":"archive","dest":"vendor/lib"}]',
    }
    original = repo.get_contents.side_effect

    def read(path, ref):
        assert ref == revision
        if path in files:
            content = files[path]
            return SimpleNamespace(
                type="file", size=len(content), decoded_content=content
            )
        return original(path, ref)

    repo.get_contents.side_effect = read
    assert read_source(repo, APP_ID).content == XML
    files["build.patch"] = f"--- a/{APP_ID}.metainfo.xml".encode()
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)
    files["build.patch"] = b"--- a/main.c\n+++ b/main.c"
    files["vendor.json"] = json.dumps(
        [{"type": "inline", "dest-filename": f"{APP_ID}.metainfo.xml"}]
    ).encode()
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)


@pytest.mark.parametrize(
    "source", [{"type": []}, {"type": "archive", "url": "https://example.org/data.tar"}]
)
def test_discovery_rejects_invalid_or_overlaid_local_source(source):
    repo = fake_repo()
    manifest = repo.get_contents("", ref="a" * 40)[1]
    module = yaml.safe_load(manifest.decoded_content)
    module["sources"].append(source)
    manifest.decoded_content = yaml.safe_dump({"modules": [module]}).encode()
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)


def test_archive_command_can_replace_a_local_listing_before_install():
    repo = fake_repo()
    manifest = repo.get_contents("", ref="a" * 40)[1]
    module = yaml.safe_load(manifest.decoded_content)
    module["sources"].append({"type": "file", "path": "data.tar.gz"})
    module["build-commands"].insert(0, "tar -xf data.tar.gz")
    manifest.decoded_content = yaml.safe_dump({"modules": [module]}).encode()
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)


@pytest.mark.parametrize("url_suffix", [".git", ""])
def test_discovery_reads_shared_modules_at_the_app_gitlink(url_suffix):
    repo = fake_repo()
    revision = "a" * 40
    shared_revision = "b" * 40
    manifest = repo.get_contents("", ref=revision)[1]
    local = yaml.safe_load(manifest.decoded_content)
    manifest.decoded_content = yaml.safe_dump(
        {"modules": ["shared-modules/deps/zlib.json", local]}
    ).encode()
    read = repo.get_contents.side_effect
    gitlink = SimpleNamespace(
        type="submodule",
        sha=shared_revision,
        submodule_git_url=f"https://github.com/flathub/shared-modules{url_suffix}",
    )
    repo.get_contents.side_effect = lambda path, ref: (
        gitlink if path == "shared-modules" and ref == revision else read(path, ref)
    )
    dependency = b'{"name":"zlib"}'
    payload = {
        "type": "file",
        "size": len(dependency),
        "encoding": "base64",
        "content": b64encode(dependency).decode(),
    }
    repo.requester.requestJsonAndCheck.return_value = ({}, payload)

    assert read_source(repo, APP_ID).content == XML
    repo.get_contents.assert_any_call("shared-modules", ref=revision)
    repo.requester.requestJsonAndCheck.assert_called_once_with(
        "GET",
        "/repos/flathub/shared-modules/contents/deps/zlib.json",
        parameters={"ref": shared_revision},
    )

    gitlink.submodule_git_url = "https://github.com/example/shared-modules.git"
    repo.requester.reset_mock()
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)
    repo.requester.requestJsonAndCheck.assert_not_called()

    gitlink.submodule_git_url = "https://github.com/flathub/shared-modules"
    dependency = b'{"cleanup-commands":["rm -rf /app/share/metainfo"]}'
    payload.update(size=len(dependency), content=b64encode(dependency).decode())
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)


@pytest.mark.parametrize("extension", ["json", "yaml"])
@pytest.mark.parametrize("section", ["build-commands", "post-install", "shell"])
def test_discovery_verifies_local_file_in_installing_module(extension, section):
    repo = fake_repo()
    manifest = repo.get_contents("", ref="a" * 40)[1]
    module = {
        "name": "metadata",
        "buildsystem": "simple",
        "sources": [{"type": "file", "path": f"{APP_ID}.metainfo.xml"}],
    }
    commands = [
        "mkdir -p /app/share/metainfo",
        (
            f'install -Dm644 "${{FLATPAK_ID}}.metainfo.xml" '
            f'"${{FLATPAK_DEST}}/share/metainfo/{APP_ID}.xml"'
        ),
    ]
    if section == "shell":
        module["sources"].append({"type": "shell", "commands": commands})
    else:
        module[section] = commands
    data = {
        "modules": [
            {
                "name": "upstream",
                "buildsystem": "meson",
                "only-arches": ["x86_64"],
                "cleanup": ["*.xml"],
                "sources": [{"type": "git", "url": "https://example.org/source.git"}],
            },
            {"name": "listing", "modules": [module]},
        ]
    }
    manifest.name = manifest.path = f"{APP_ID}.{extension}"
    manifest.decoded_content = (
        json.dumps(data) if extension == "json" else yaml.safe_dump(data)
    ).encode()
    assert read_source(repo, APP_ID).content == XML
    data["modules"].reverse()
    manifest.decoded_content = (
        json.dumps(data) if extension == "json" else yaml.safe_dump(data)
    ).encode()
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)
    data["modules"].reverse()
    data["cleanup"] = ["/include"]
    manifest.decoded_content = (
        yaml.safe_dump(data).encode()
        if extension == "yaml"
        else json.dumps(data).encode()
    )
    assert read_source(repo, APP_ID).content == XML
    data["cleanup"] = ["/share/metainfo/*"]
    manifest.decoded_content = (
        yaml.safe_dump(data).encode()
        if extension == "yaml"
        else json.dumps(data).encode()
    )
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)


@pytest.mark.parametrize(
    "extra",
    [
        {"buildsystem": "meson"},
        {"subdir": "upstream"},
        {"builddir": True},
        {"only-arches": ["x86_64"]},
        {"cleanup-commands": ["rm -f /app/share/metainfo/*.xml"]},
        {"post-install": [f"python3 generate.py > {APP_ID}.metainfo.xml"]},
        {"post-install": [f"sed -i s/old/new/ {APP_ID}.metainfo.xml"]},
        {"sources": [{"type": "git", "url": "https://example.org/upstream.git"}]},
        {
            "sources": [
                {"type": "file", "url": f"https://example.org/{APP_ID}.metainfo.xml"}
            ]
        },
        {
            "sources": [
                {"type": "file", "path": f"{APP_ID}.metainfo.xml", "dest": "upstream"}
            ]
        },
        {
            "sources": [
                {
                    "type": "file",
                    "path": f"{APP_ID}.metainfo.xml",
                    "dest-filename": "other.xml",
                }
            ]
        },
        {
            "sources": [
                {
                    "type": "file",
                    "path": f"{APP_ID}.metainfo.xml",
                    "only-arches": ["x86_64"],
                }
            ]
        },
        {"sources": [{"type": "file", "path": [f"{APP_ID}.metainfo.xml"]}]},
        {
            "sources": [
                {"type": "file", "path": f"{APP_ID}.metainfo.xml"},
                {"type": "patch", "path": "metadata.patch"},
            ]
        },
        {"modules": ["other-module.json"]},
    ],
)
def test_discovery_rejects_unverified_installation(extra):
    repo = fake_repo()
    manifest = repo.get_contents("", ref="a" * 40)[1]
    module = yaml.safe_load(manifest.decoded_content)
    module.update(extra)
    manifest.decoded_content = yaml.safe_dump({"modules": [module]}).encode()
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)


def test_recursive_yaml_modules_are_rejected():
    repo = fake_repo()
    manifest = repo.get_contents("", ref="a" * 40)[1]
    manifest.decoded_content = b"modules: &modules\n  - modules: *modules\n"
    with pytest.raises(MetadataError, match="unsupported_metadata"):
        read_source(repo, APP_ID)


@pytest.mark.parametrize(
    "command",
    [
        'install -Dm644 "${FLATPAK_ID}.metainfo.xml" "${FLATPAK_DEST}/share/metainfo/${FLATPAK_ID}.xml"',
        "install -D -m 644 -t /app/share/metainfo $FLATPAK_ID.metainfo.xml",
        "install -Dpt /app/share/appdata/ ./org.example.App.metainfo.xml",
        "install --mode 644 --target-directory=/app/share/metainfo org.example.App.metainfo.xml",
        "install -Dm 0644 org.example.App.metainfo.xml /app/share/metainfo/",
        'install -D --mode=0644 --target-directory="${FLATPAK_DEST}/share/metainfo" ${FLATPAK_ID}.metainfo.xml',
        "install -Dm644 org.example.App.metainfo.xml /app/share/metainfo/;",
        "cp org.example.App.metainfo.xml /app/share/metainfo/",
        'cp -pv "${FLATPAK_ID}.metainfo.xml" "${FLATPAK_DEST}/share/appdata/${FLATPAK_ID}.xml"',
        "cp --no-target-directory org.example.App.metainfo.xml /app/share/metainfo/org.example.App.xml",
        "mv org.example.App.metainfo.xml /app/share/metainfo/",
        "mv -v --target-directory=/app/share/metainfo ./org.example.App.metainfo.xml",
    ],
)
def test_common_direct_install_syntax(command):
    assert _direct_install(command, f"{APP_ID}.metainfo.xml", APP_ID)


@pytest.mark.parametrize(
    "command",
    [
        "echo install -Dm644 org.example.App.metainfo.xml /app/share/metainfo/",
        "install -Dm644 upstream/org.example.App.metainfo.xml /app/share/metainfo/",
        "install -Dm644 $OTHER.metainfo.xml /app/share/metainfo/",
        "install -Dm644 '$FLATPAK_ID.metainfo.xml' /app/share/metainfo/",
        "install -Dm644 org.example.App.metainfo.xml /app/share/metainfo/../other.xml",
        "install -Dm644 org.example.App.metainfo.xml /app/share/icons/",
        "install -Dm644 org.example.App.metainfo.xml /app/share/metainfo/ && generate",
        "install -Dm644 'org.example.App.metainfo.xml /app/share/metainfo/",
        "install -d /app/share/metainfo/",
        "install -Dm644 org.example.App.metainfo.xml /app/share/metainfo",
        "cp -s org.example.App.metainfo.xml /app/share/metainfo/",
        "cp -r . /app/share/metainfo/",
        "cp org.example.App.metainfo.xml other.xml /app/share/metainfo/",
        "cp upstream/org.example.App.metainfo.xml /app/share/metainfo/",
        "mv org.example.App.metainfo.xml /app/share/metainfo/; generate",
        "cp --mode=0644 org.example.App.metainfo.xml /app/share/metainfo/",
        "install --mode=invalid org.example.App.metainfo.xml /app/share/metainfo/",
    ],
)
def test_indirect_or_unsupported_install_rejected(command):
    assert not _direct_install(command, f"{APP_ID}.metainfo.xml", APP_ID)


def test_json_commands_are_decoded_and_scoped():
    text = (
        '{"modules": [{"build-commands": ['
        '"install -Dm644 \\"${FLATPAK_ID}.metainfo.xml\\" '
        '\\"${FLATPAK_DEST}/share/metainfo/${FLATPAK_ID}.xml\\""],'
        '"sources": [{"path": "ignored"}]}]}'
    )
    commands = _install_commands(_load_manifest(text, "manifest.json")["modules"][0])
    assert len(commands) == 1
    assert _direct_install(commands[0], f"{APP_ID}.metainfo.xml", APP_ID)


def test_yaml_commands_and_continuations_are_scoped():
    text = """modules:
  - name: metadata
    build-commands:
      # install something else
      - |
        install -Dm644 \\
          "${FLATPAK_ID}.metainfo.xml" \\
          "${FLATPAK_DEST}/share/metainfo/${FLATPAK_ID}.xml"
    sources:
      - path: ignored
"""
    commands = _install_commands(_load_manifest(text, "manifest.yaml")["modules"][0])
    assert len(commands) == 1
    assert _direct_install(commands[0], f"{APP_ID}.metainfo.xml", APP_ID)


@pytest.mark.parametrize("key", ["build-commands", "post-install"])
def test_command_sections_support_indentless_yaml_lists(key):
    text = f"""
{key}: # metadata
- install -Dm644 $FLATPAK_ID.metainfo.xml /app/share/metainfo/
sources:
- path: ignored
"""
    commands = _install_commands(_load_manifest(text, "manifest.yml"))
    assert len(commands) == 1
    assert _direct_install(commands[0], f"{APP_ID}.metainfo.xml", APP_ID)


def test_flatpak_json_multiline_strings():
    text = (
        '{"description": "first line\nsecond line", "post-install": ['
        '"install -Dm644 org.example.App.metainfo.xml /app/share/metainfo/"]}'
    )
    commands = _install_commands(_load_manifest(text, "manifest.json"))
    assert len(commands) == 1
    assert _direct_install(commands[0], f"{APP_ID}.metainfo.xml", APP_ID)


def test_json_comments_do_not_become_commands_or_damage_urls():
    text = """{
      // "build-commands": ["install ignored"]
      "url": "https://example.org/source",
      /* install ignored */
      "post-install": [
        "install -Dm644 org.example.App.metainfo.xml /app/share/metainfo/"
      ]
    }"""
    commands = _install_commands(_load_manifest(text, "manifest.json"))
    assert len(commands) == 1
    assert _direct_install(commands[0], f"{APP_ID}.metainfo.xml", APP_ID)


def test_yaml_first_module_key_and_folded_command():
    text = """modules:
- build-commands:
  - install -Dm644 org.example.App.metainfo.xml
      /app/share/metainfo/org.example.App.metainfo.xml
  name: metadata
  sources:
  - path: ignored
"""
    commands = _install_commands(_load_manifest(text, "manifest.yml")["modules"][0])
    assert len(commands) == 1
    assert _direct_install(commands[0], f"{APP_ID}.metainfo.xml", APP_ID)


@pytest.mark.parametrize("style", [">", ">-", ">+"])
def test_yaml_folded_block_commands(style):
    text = f"""build-commands:
  - {style}
    install -Dm644
    "${{FLATPAK_ID}}.metainfo.xml"
    "${{FLATPAK_DEST}}/share/metainfo/${{FLATPAK_ID}}.xml"
sources:
  - path: ignored
"""
    commands = _install_commands(_load_manifest(text, "manifest.yaml"))
    assert len(commands) == 1
    assert _direct_install(commands[0], f"{APP_ID}.metainfo.xml", APP_ID)


@pytest.mark.parametrize("style", ["|", "|-", "|+"])
def test_yaml_literal_block_commands(style):
    text = f"""build-commands:
  - {style}
    mkdir -p /app/share/metainfo
    cp org.example.App.metainfo.xml /app/share/metainfo/
"""
    commands = _install_commands(_load_manifest(text, "manifest.yaml"))
    assert len(commands) == 2
    assert not _direct_install(commands[0], f"{APP_ID}.metainfo.xml", APP_ID)
    assert _direct_install(commands[1], f"{APP_ID}.metainfo.xml", APP_ID)


@pytest.mark.parametrize("executable", ["cp", "mv"])
def test_discovery_accepts_direct_file_copy_or_move(executable):
    repo = fake_repo()
    manifest = repo.get_contents("", ref="a" * 40)[1]
    manifest.decoded_content = (
        f"buildsystem: simple\nsources:\n  - type: file\n"
        f"    path: {APP_ID}.metainfo.xml\n"
        f"build-commands:\n  - {executable} {APP_ID}.metainfo.xml "
        "/app/share/metainfo/\n"
    ).encode()
    assert read_source(repo, APP_ID).content == XML


def test_submission_writes_only_branch_then_opens_pr():
    repo, _ = saving_repo()
    repo.default_branch = "main"
    changes = {unit(document(), "summary").id: "Neue Zusammenfassung"}
    result = submit_translation(repo, APP_ID, "de", "a" * 40, changes)
    assert result["state"] == "open"
    branch = repo.update_file.call_args.kwargs["branch"]
    assert branch.startswith("translations/de/")
    assert repo.get_branch.call_args_list[0].args == ("master",)
    assert repo.create_git_ref.call_args.args == (f"refs/heads/{branch}", "a" * 40)
    assert repo.create_pull.call_args.kwargs["base"] == "master"
    assert repo.create_pull.call_args.kwargs["head"] == branch


def test_stale_submission_does_not_write():
    repo = fake_repo()
    with pytest.raises(MetadataError, match="source_changed"):
        submit_translation(repo, APP_ID, "de", "b" * 40, {"x": "y"})
    repo.create_git_ref.assert_not_called()
    repo.update_file.assert_not_called()
    repo.create_pull.assert_not_called()


def test_retry_refuses_unrelated_orphan_branch_changes():
    repo, _ = saving_repo()
    changes = {unit(document(), "summary").id: "New"}
    repo.create_pull.side_effect = GithubException(502, {})
    with pytest.raises(GithubException):
        submit_translation(repo, APP_ID, "de", "a" * 40, changes)
    repo.compare.return_value.files = [
        SimpleNamespace(filename="README.md", status="modified")
    ]
    with pytest.raises(MetadataError, match="source_changed"):
        submit_translation(repo, APP_ID, "de", "a" * 40, changes)
    repo.create_pull.assert_called_once()
    repo.update_file.assert_called_once()


@pytest.mark.parametrize("reviewer_reverted", [False, True])
def test_save_during_publication_keeps_newer_wording(
    batch_db, publishing_repo, reviewer_reverted
):
    repo, saved = publishing_repo
    key = unit(document(), "summary").id

    def save(text):
        batches.queue_translation(repo, APP_ID, "de", "a" * 40, {key: text}, 42)

    save("First")
    update = repo.update_file.side_effect

    def save_before_update(*args, **kwargs):
        save("Second")
        return update(*args, **kwargs)

    repo.update_file.side_effect = save_before_update
    batches.publish_translation_batches()
    repo.update_file.side_effect = update
    if reviewer_reverted:
        saved.decoded_content = XML
    batches.publish_translation_batches()
    assert unit(document(saved.decoded_content), "summary").translation == (
        unit(document(), "summary").translation if reviewer_reverted else "Second"
    )
    if reviewer_reverted:
        with batch_db() as db:
            assert [
                u["translation"]
                for u in db.query(MetadataTranslationBatch).one().previous_translations
            ] == ["Second"]
    repo.create_pull.assert_called_once()


@pytest.mark.parametrize("reviewed", [False, True])
@pytest.mark.parametrize(
    "field, first", [("summary", "First"), ("keywords", "First\n\n keyword")]
)
def test_retry_after_lost_write_and_new_save(
    batch_db, publishing_repo, reviewed, field, first
):
    repo, saved = publishing_repo
    key = unit(document(), field).id

    def save(value):
        batches.queue_translation(repo, APP_ID, "de", "a" * 40, {key: value}, 42)

    save(first)
    create = repo.create_pull.side_effect

    def lose_response(**kwargs):
        create(**kwargs)
        raise ConnectionResetError()

    repo.create_pull.side_effect = lose_response
    with pytest.raises(ConnectionResetError):
        batches.publish_translation_batches()
    save("Second")
    if reviewed:
        doc = document(saved.decoded_content)
        saved.decoded_content = doc.apply({unit(doc, field).id: "Reviewed"})
    batches.publish_translation_batches()
    assert unit(document(saved.decoded_content), field).translation == (
        "Reviewed" if reviewed else "Second"
    )
    with batch_db() as db:
        batch = db.query(MetadataTranslationBatch).one()
        assert [u["translation"] for u in batch.previous_translations] == (
            ["Second"] if reviewed else []
        )


def test_two_lost_responses_keep_evidence_for_both_fields(batch_db, publishing_repo):
    repo, saved = publishing_repo
    summary = unit(document(), "summary").id
    name = unit(document(), "name").id

    def save(key, value):
        batches.queue_translation(repo, APP_ID, "de", "a" * 40, {key: value}, 42)

    save(summary, "First")
    update = repo.update_file.side_effect

    def lose_response(*args, **kwargs):
        update(*args, **kwargs)
        raise ConnectionResetError()

    repo.update_file.side_effect = lose_response
    with pytest.raises(ConnectionResetError):
        batches.publish_translation_batches()
    save(name, "Name")
    with pytest.raises(ConnectionResetError):
        batches.publish_translation_batches()
    save(summary, "Second")
    repo.update_file.side_effect = update
    batches.publish_translation_batches()
    assert unit(document(saved.decoded_content), "summary").translation == "Second"
    assert unit(document(saved.decoded_content), "name").translation == "Name"
    repo.create_pull.assert_called_once()


def test_retargeted_pr_does_not_receive_translation_updates():
    repo, _ = saving_repo()
    summary = unit(document(), "summary")
    submit_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "First"})
    repo.pulls[1].base.ref = "beta"
    with pytest.raises(MetadataError, match="source_changed"):
        submit_translation(
            repo, APP_ID, "de", "a" * 40, {summary.id: "Second"}, pull_number=1
        )
    repo.update_file.assert_called_once()
    repo.create_pull.assert_called_once()


def test_retry_returns_existing_pr_without_writing():
    repo = fake_repo()
    changes = {unit(document(), "summary").id: "Neue Zusammenfassung"}
    original_read = repo.get_contents.side_effect
    updated = SimpleNamespace(
        decoded_content=document().apply(changes), sha="updated-sha"
    )
    repo.get_contents.side_effect = lambda path, ref: (
        updated if ref.startswith("translations/") else original_read(path, ref)
    )
    repo.get_pulls.return_value = [
        SimpleNamespace(
            html_url="https://github.com/flathub/org.example.App/pull/1",
            number=1,
            base=SimpleNamespace(ref="master"),
            state="open",
            merged=False,
        )
    ]
    repo.get_pull.return_value = repo.get_pulls.return_value[0]
    result = submit_translation(
        repo,
        APP_ID,
        "de",
        "a" * 40,
        changes,
    )
    assert result["state"] == "open"
    repo.create_git_ref.assert_not_called()
    repo.update_file.assert_not_called()


@pytest.fixture
def publishing_repo(monkeypatch):
    repo, saved = saving_repo()
    monkeypatch.setattr(
        batches, "Github", lambda _: SimpleNamespace(get_repo=lambda _: repo)
    )
    return repo, saved


def saving_repo():
    repo = fake_repo()
    original_read = repo.get_contents.side_effect
    saved = SimpleNamespace(decoded_content=XML, sha="file-sha")
    branches = {}
    heads = {}
    pulls = {}

    def create_ref(ref, sha):
        branch = ref.removeprefix("refs/heads/")
        if branch in branches:
            raise GithubException(422, {"message": "Reference already exists"})
        source = original_read("", sha)[0]
        branches[branch] = (
            SimpleNamespace(decoded_content=source.decoded_content, sha=source.sha)
            if branches
            else saved
        )
        branches[branch].path = source.path

    def get_ref(ref):
        if ref.removeprefix("heads/") not in branches:
            raise GithubException(404, {"message": "Not found"})
        return SimpleNamespace()

    repo.create_git_ref.side_effect = create_ref
    repo.get_git_ref.side_effect = get_ref

    def read(path, ref):
        if ref in branches or ref in heads:
            file = branches.get(ref) or heads[ref]
            if path == file.path:
                return file
            raise GithubException(404, {"message": "Not found"})
        return original_read(path, ref)

    repo.get_contents.side_effect = read
    repo.get_pulls.side_effect = lambda *, state, head, base=None: [
        p
        for p in reversed(pulls.values())
        if p.head.label == head
        and state in ("all", p.state)
        and (base is None or p.base.ref == base)
    ]

    def update(path, message, content, sha, *, branch):
        assert sha == branches[branch].sha
        branches[branch].decoded_content = content
        branches[branch].sha += "-updated"
        pin_head(branch)

    def pin_head(branch):
        for pull in pulls.values():
            if pull.head.label == f"{repo.owner.login}:{branch}":
                sha = f"pr-commit-{len(heads) + 1}"
                heads[sha] = SimpleNamespace(**vars(branches[branch]))
                pull.head.sha = sha

    def create(**kwargs):
        number = len(pulls) + 1
        pull = SimpleNamespace(
            html_url=f"https://github.com/flathub/org.example.App/pull/{number}",
            number=number,
            base=SimpleNamespace(ref=kwargs["base"]),
            head=SimpleNamespace(
                label=f"{repo.owner.login}:{kwargs['head']}", sha=f"pr-head-{number}"
            ),
            state="open",
            merged=False,
            merge_commit_sha=None,
        )
        pulls[pull.number] = pull
        pull.edit = lambda *, state: setattr(pull, "state", state)
        pin_head(kwargs["head"])
        return pull

    repo.update_file.side_effect = update
    repo.create_pull.side_effect = create
    repo.get_pull.side_effect = pulls.__getitem__
    repo.branches = branches
    repo.pulls = pulls
    repo.pin_head = pin_head
    return repo, saved


def test_successive_saves_update_one_pr_and_preserve_previous_fields():
    repo, saved = saving_repo()
    doc = document()
    first = submit_translation(
        repo, APP_ID, "de", "a" * 40, {unit(doc, "summary").id: "Neu"}
    )
    second = submit_translation(
        repo, APP_ID, "de", "a" * 40, {unit(doc, "name").id: "Beispiel"}
    )
    assert first == second
    assert unit(document(saved.decoded_content), "summary").translation == "Neu"
    assert unit(document(saved.decoded_content), "name").translation == "Beispiel"
    repo.create_pull.assert_called_once()
    repo.create_git_ref.assert_called_once()
    assert repo.update_file.call_count == 2


def test_pending_translations_reload_with_original_unit_ids():
    repo, saved = saving_repo()
    doc = document(locale="fr")
    paragraphs = [u for u in doc.units() if u.field == "description"]
    submit_translation(
        repo,
        APP_ID,
        "fr",
        "a" * 40,
        {paragraphs[0].id: "Utiliser <code>{name}</code>."},
    )
    submit_translation(
        repo,
        APP_ID,
        "fr",
        "a" * 40,
        {paragraphs[1].id: "Deuxième paragraphe."},
    )
    loaded = read_translation_document(repo, read_source(repo, APP_ID), APP_ID, "fr")
    loaded_units = {item.id: item for item in loaded.units()}
    assert loaded_units[paragraphs[0].id].translation == "Utiliser <code>{name}</code>."
    assert loaded_units[paragraphs[1].id].translation == "Deuxième paragraphe."
    assert set(loaded_units) == {item.id for item in doc.units()}
    assert b"Deuxi" in saved.decoded_content


def test_reload_document_edits_the_pending_tree():
    repo, _ = saving_repo()
    doc = document(locale="fr")
    summary = unit(doc, "summary")
    submit_translation(repo, APP_ID, "fr", "a" * 40, {summary.id: "Nouveau"})
    loaded = read_translation_document(repo, read_source(repo, APP_ID), APP_ID, "fr")
    output = loaded.apply({unit(loaded, "name").id: "Exemple"})
    assert unit(document(output, "fr"), "summary").translation == "Nouveau"


def test_unrelated_commit_preserves_pending_pr_on_reload_and_save():
    repo, saved = saving_repo()
    doc = document()
    submit_translation(repo, APP_ID, "de", "a" * 40, {unit(doc, "summary").id: "Neu"})
    branch = repo.create_pull.call_args.kwargs["head"]
    repo.get_branch.return_value.commit.sha = "b" * 40
    loaded = read_translation_document(repo, read_source(repo, APP_ID), APP_ID, "de")
    assert unit(loaded, "summary").translation == "Neu"
    submit_translation(
        repo, APP_ID, "de", "b" * 40, {unit(loaded, "name").id: "Beispiel"}
    )
    repo.create_pull.assert_called_once()
    assert repo.update_file.call_args.kwargs["branch"] == branch
    assert unit(document(saved.decoded_content), "summary").translation == "Neu"


def test_metadata_file_change_does_not_reuse_old_pending_translations():
    repo, _ = saving_repo()
    submit_translation(
        repo, APP_ID, "de", "a" * 40, {unit(document(), "summary").id: "Neu"}
    )
    metadata = repo.get_contents("", ref="a" * 40)[0]
    metadata.decoded_content = XML.replace(b"Read &amp; write", b"New source")
    metadata.sha = "new-file-sha"
    repo.get_branch.return_value.commit.sha = "b" * 40
    loaded = read_translation_document(repo, read_source(repo, APP_ID), APP_ID, "de")
    assert unit(loaded, "summary").source == "New source"
    assert unit(loaded, "summary").translation == "Lesen und schreiben"
    repo.update_file.reset_mock()
    with pytest.raises(MetadataError, match="source_changed"):
        submit_translation(
            repo, APP_ID, "de", "a" * 40, {unit(document(), "name").id: "Beispiel"}
        )
    repo.update_file.assert_not_called()


def test_save_can_revert_previous_translation_to_original_value():
    repo, saved = saving_repo()
    summary = unit(document(), "summary")
    submit_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Neu"})
    submit_translation(repo, APP_ID, "de", "a" * 40, {summary.id: summary.translation})
    assert (
        unit(document(saved.decoded_content), "summary").translation
        == summary.translation
    )
    repo.create_pull.assert_called_once()


def test_changed_pr_source_is_not_overwritten():
    repo, saved = saving_repo()
    summary = unit(document(), "summary")
    submit_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Neu"})
    saved.decoded_content = saved.decoded_content.replace(
        b"Read &amp; write", b"New source"
    )
    repo.update_file.reset_mock()
    with pytest.raises(MetadataError, match="source_changed"):
        submit_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Anders"})
    repo.update_file.assert_not_called()


def test_closed_pr_is_not_silently_updated():
    repo, _ = saving_repo()
    summary = unit(document(), "summary")
    submit_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Neu"})
    repo.pulls[1].state = "closed"
    repo.update_file.reset_mock()
    with pytest.raises(MetadataError, match="pull_request_closed"):
        submit_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Anders"})
    repo.update_file.assert_not_called()


def test_concurrent_save_reports_conflict_without_creating_another_pr():
    repo, _ = saving_repo()
    summary = unit(document(), "summary")
    submit_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Neu"})
    repo.update_file.side_effect = GithubException(409, {"message": "sha changed"})
    with pytest.raises(MetadataError, match="source_changed"):
        submit_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Anders"})
    repo.create_pull.assert_called_once()


def test_saving_preserves_maintainer_edits_to_other_translations():
    repo, saved = saving_repo()
    summary = unit(document(), "summary")
    submit_translation(repo, APP_ID, "de", "a" * 40, {summary.id: "Neu"})
    saved.decoded_content = saved.decoded_content.replace(
        b"Lire et \xc3\xa9crire", b"Lire et modifier"
    )
    submit_translation(
        repo, APP_ID, "de", "a" * 40, {unit(document(), "name").id: "Beispiel"}
    )
    assert (
        unit(document(saved.decoded_content, "fr"), "summary").translation
        == "Lire et modifier"
    )

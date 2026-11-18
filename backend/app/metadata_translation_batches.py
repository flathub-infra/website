"""Save and publish shared edits for each app and language."""

import hashlib
import json
import logging
import re
from collections import Counter
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from functools import partial
from urllib.parse import urlsplit
from uuid import uuid4

from github import Github, GithubException
from sqlalchemy.dialects.postgresql import insert

from . import config
from .database import get_db
from .metadata_translation_github import (
    SOURCE_BRANCH,
    ClosedTranslationPull,
    MetadataSource,
    ReviewedFieldsChanged,
    merged_translation_content,
    read_reviewed_fields,
    read_source,
    read_translation_document,
    submit_translation,
    translation_pull_request,
)
from .metadata_translation_reconciliation import reconcile
from .metadata_translations import (
    MetadataDocument,
    MetadataError,
    SharedTranslationUnit,
    normalize_locale,
)
from .models import MetadataTranslationBatch

logger = logging.getLogger(__name__)


def _query(db, app_id: str, locale: str):
    return db.query(MetadataTranslationBatch).filter_by(
        app_id=app_id, locale=normalize_locale(locale)
    )


class TextConflict(MetadataError):
    def __init__(self, unit):
        super().__init__("text_conflict")
        self.unit = unit


def _fingerprint(unit):
    return hashlib.sha256(
        json.dumps(
            [unit.field, unit.context, unit.source, unit.translation],
            ensure_ascii=False,
        ).encode()
    ).hexdigest()


def shared_unit(unit, edits):
    fingerprint = _fingerprint(unit)
    edit = edits.get(unit.id, {})
    matches = edit.get("fingerprint") == fingerprint
    return SharedTranslationUnit(
        **unit.model_dump(exclude={"version", "last_editor_id"}),
        version=edit["version"] if matches else fingerprint,
        last_editor_id=edit["user_id"] if matches else None,
    )


def _annotate(document, edits):
    # Adding a translation can change an XPath. Duplicate text can't identify its author.
    by_text = {
        edit["fingerprint"]: edit for edit in edits.values() if edit.get("unique")
    }
    counts = Counter(_fingerprint(entry.unit) for entry in document.nodes.values())
    for entry in document.nodes.values():
        unit = entry.unit
        fingerprint = _fingerprint(unit)
        if (
            counts[fingerprint] == 1
            and fingerprint in by_text
            and edits.get(unit.id, {}).get("fingerprint") != fingerprint
        ):
            entry.unit = shared_unit(unit, {unit.id: by_text[fingerprint]})
        else:
            entry.unit = shared_unit(unit, edits)
    return document


def _source(batch: MetadataTranslationBatch) -> MetadataSource:
    assert batch.source_content is not None
    return MetadataSource(
        batch.revision, batch.path, batch.source_sha, batch.source_content
    )


def _pull_number(url: str):
    match = re.fullmatch(r".+/pull/([1-9][0-9]*)", urlsplit(url).path)
    return int(match[1]) if match else None


def _recorded_pull(repo, url: str):
    number = _pull_number(url)
    return repo.get_pull(number) if number is not None else None


def _batch_pull(repo, batch):
    if batch.url:
        return _recorded_pull(repo, batch.url)
    return translation_pull_request(
        repo, _source(batch), batch.locale, batch.generation
    )


def _saved_edits(previous, content, published_ids, *, exclude=()):
    return {
        unit.id: unit.translation
        for unit in previous.with_pending(content).units()
        if unit.id not in exclude
        and (
            unit.translation != previous.nodes[unit.id].unit.translation
            or unit.id in published_ids
        )
    }


def _retain(batch, units):
    retained = list(batch.previous_translations)
    for unit in units:
        item = unit.model_dump()
        if item not in retained:
            retained.append(item)
    batch.previous_translations = retained


def _omitted_edits(previous, saved_content, reviewed, queued, published_ids=()):
    if (
        reviewed is not None
        and reviewed.anchored_to is not None
        and reviewed.anchored_to.content == previous.content
    ):
        previous = reviewed.anchored_to
    saved = _saved_edits(previous, saved_content, published_ids, exclude=queued)
    accepted = reconcile(previous, reviewed, saved).satisfied
    return [
        previous.nodes[key].unit.model_copy(update={"translation": value})
        for key, value in saved.items()
        if key not in accepted
    ]


def _retain_omitted_edits(batch, previous, reviewed):
    _retain(
        batch,
        _omitted_edits(
            previous, batch.content, reviewed, batch.changes, batch.published_ids
        ),
    )


def _reviewed_document(repo, pull, path, app_id, locale):
    content = merged_translation_content(repo, pull, path)
    if content is not None:
        try:
            return MetadataDocument(content, app_id, locale)
        except MetadataError:
            pass
    return None


def _batch_error(source, batch, pull):
    if batch.source_content is None:
        return None
    if pull is not None and pull.base.ref != SOURCE_BRANCH:
        return "source_changed"
    changed = (batch.source_sha, batch.path) != (source.sha, source.path)
    if changed and batch.changes:
        return "source_changed"
    if changed:
        return "source_changed" if pull is not None and not pull.merged else None
    if pull is not None and pull.state != "open":
        return "pull_request_closed"
    if pull is not None and batch.error == "pull_request_closed":
        return None
    return batch.error


def read_saved_translation(repo, source, app_id, locale):
    # A replica can lag behind the last save.
    with get_db("writer") as db:
        batch: MetadataTranslationBatch | None = _query(db, app_id, locale).first()
        if batch is not None:
            db.expunge(batch)
    pull = (
        _batch_pull(repo, batch)
        if batch is not None and batch.url and batch.source_content is not None
        else None
    )
    edits = batch.field_edits if batch is not None else {}
    previous = batch.previous_translations if batch is not None else []
    error = _batch_error(source, batch, pull) if batch is not None else None
    same_source = batch is not None and (batch.source_sha, batch.path) == (
        source.sha,
        source.path,
    )
    if same_source and batch.error == "pull_request_closed" and error is None:
        with get_db("writer") as db:
            _query(db, app_id, locale).filter_by(
                url=batch.url,
                source_sha=batch.source_sha,
                error="pull_request_closed",
                state=batch.state,
            ).update(
                {
                    "error": None,
                    "state": "queued" if batch.changes else "submitted",
                    "next_review_check": None,
                },
                synchronize_session=False,
            )
    url = batch.url if same_source else None
    generation = batch.generation if same_source else 0
    saved_content = batch.content if same_source else None
    state = "submitted" if url else None
    document = None
    if batch is not None and (batch.changes or error):
        assert batch.content is not None
        if (batch.source_sha, batch.path) != (source.sha, source.path):
            error = "source_changed"
            source = _source(batch)
        document = MetadataDocument(source.content, app_id, locale).with_pending(
            batch.content
        )
        state, url = "failed" if error else "queued", batch.url
    elif same_source and saved_content is None:
        document = MetadataDocument(source.content, app_id, locale)
    if document is None:
        try:
            document = read_translation_document(
                repo,
                source,
                app_id,
                locale,
                generation,
                pull=pull if url else None,
            )
            if url and saved_content is not None and saved_content != document.content:
                with get_db("writer") as db:
                    batch = _query(db, app_id, locale).with_for_update().first()
                    if (
                        batch is not None
                        and not batch.changes
                        and batch.url == url
                        and batch.content == saved_content
                        and batch.source_content == source.content
                    ):
                        _retain_omitted_edits(
                            batch,
                            MetadataDocument(source.content, app_id, locale),
                            document,
                        )
                        batch.content = document.content
                        batch.missing_texts = sum(
                            not u.translation.strip() for u in document.units()
                        )
                        previous = batch.previous_translations
        except MetadataError as conflict:
            if str(conflict) != "source_changed" or saved_content is None:
                raise
            document = MetadataDocument(source.content, app_id, locale).with_pending(
                saved_content
            )
            state = "failed"
            error = "source_changed"
    return source, _annotate(document, edits), state, error, url, previous


def unavailable_source_snapshot(app_id, locale):
    with get_db("writer") as db:
        batch = _query(db, app_id, locale).first()
        if batch is None:
            return None
        units = []
        license = ""
        if batch.source_content is not None and batch.content is not None:
            document = MetadataDocument(
                batch.source_content, app_id, locale
            ).with_pending(batch.content)
            units = _annotate(document, batch.field_edits).units()
            license = document.license
        elif not batch.previous_translations:
            return None
        return {
            "revision": batch.revision,
            "path": batch.path,
            "locale": batch.locale,
            "units": units,
            "metadata_license": license,
            "previous_translations": batch.previous_translations,
            "pull_request_url": batch.url,
            "batch_state": "failed",
            "batch_error": "source_unavailable",
            "can_submit": False,
            "source_url": f"https://github.com/flathub/{app_id}/blob/{batch.revision}/{batch.path}",
        }


def queue_translation(
    repo, app_id, locale, revision, changes, user_id, *, versions=None
):
    source = read_source(repo, app_id)
    if source.revision != revision:
        try:
            previous = repo.get_contents(source.path, ref=revision)
        except GithubException as error:
            if error.status != 404:
                raise
            raise MetadataError("source_changed") from error
        if isinstance(previous, list) or previous.sha != source.sha:
            raise MetadataError("source_changed")
    document = MetadataDocument(source.content, app_id, locale)
    changes = {key: value.strip() for key, value in changes.items()}
    if not document.license:
        raise MetadataError("missing_license")
    with get_db("writer") as db:
        db.execute(
            insert(MetadataTranslationBatch)
            .values(
                app_id=app_id,
                locale=document.locale,
                revision=source.revision,
                source_sha=source.sha,
                path=source.path,
                source_content=source.content,
                content=source.content,
                changes={},
                state="queued",
            )
            .on_conflict_do_nothing()
        )
        batch = _query(db, app_id, locale).with_for_update().one()
        pull = (
            _batch_pull(repo, batch)
            if batch.url and batch.source_content is not None
            else None
        )
        if pull is not None and pull.base.ref != SOURCE_BRANCH:
            raise MetadataError("source_changed")
        if (batch.source_sha, batch.path) != (source.sha, source.path):
            if batch.changes or (
                batch.source_content is not None
                and batch.url
                and (pull is None or not pull.merged)
            ):
                raise MetadataError("source_changed")
            if batch.url and batch.source_content is not None:
                _retain_omitted_edits(
                    batch,
                    MetadataDocument(batch.source_content, app_id, locale),
                    _reviewed_document(repo, pull, batch.path, app_id, locale),
                )
            batch.url = None
            batch.published_ids = []
            batch.generation = 0
        else:
            if (batch.source_content is None and batch.url) or (
                pull is not None and pull.merged
            ):
                if batch.source_content is not None:
                    _retain_omitted_edits(
                        batch,
                        document,
                        _reviewed_document(repo, pull, batch.path, app_id, locale),
                    )
                batch.url = None
                batch.published_ids = []
                # A merged PR cannot accept another save, even if the blob is unchanged.
                batch.generation += 1
        original = document
        document = read_translation_document(
            repo,
            source,
            app_id,
            locale,
            batch.generation,
            pull_number=_pull_number(batch.url) if batch.url else None,
        )
        combined = {**batch.changes, **changes}
        if changes.keys() - document.nodes.keys():
            raise MetadataError("invalid_units")
        publication_base = dict(batch.publication_base)
        for key in changes:
            publication_base.setdefault(key, document.nodes[key].unit.translation)
        if versions is not None:
            if (
                versions.keys() != changes.keys()
                or changes.keys() - document.nodes.keys()
            ):
                raise MetadataError("invalid_units")
            pending = (
                original.with_pending(batch.content)
                if changes.keys() & batch.changes.keys()
                else None
            )
            current_units = _annotate(document, batch.field_edits).nodes
            pending_units = (
                _annotate(pending, batch.field_edits).nodes if pending else {}
            )
            for key, version in versions.items():
                current = (pending_units if key in batch.changes else current_units)[
                    key
                ].unit
                if current.version != version:
                    raise TextConflict(current)
        if batch.url and batch.content is not None:
            _retain(
                batch,
                _omitted_edits(
                    original, batch.content, document, combined, batch.published_ids
                ),
            )
        try:
            output = document.apply(combined)
        except MetadataError as error:
            if str(error) != "no_changes":
                raise
            output = document.content
        batch.revision = source.revision
        batch.source_sha = source.sha
        batch.path = source.path
        batch.source_content = source.content
        batch.content = output
        batch.publication_base = publication_base
        batch.state = "queued"
        batch.error = None
        units = _annotate(original.with_pending(output), batch.field_edits).units()
        batch.changes = {u.id: u.translation for u in units if u.id in combined}
        batch.missing_texts = sum(not u.translation.strip() for u in units)
        counts = Counter(_fingerprint(u) for u in units)
        edits = {}
        for unit in units:
            if unit.id in changes or unit.last_editor_id is not None:
                edits[unit.id] = {
                    "version": uuid4().hex if unit.id in changes else unit.version,
                    "user_id": user_id if unit.id in changes else unit.last_editor_id,
                    "fingerprint": _fingerprint(unit),
                    "unique": counts[_fingerprint(unit)] == 1,
                }
        batch.field_edits = edits
        return {
            "url": batch.url,
            "state": "queued",
            "units": [shared_unit(unit, edits) for unit in units],
        }


def rebase_translation(repo, app_id, locale, revision):
    with get_db("writer") as db:
        batch = _query(db, app_id, locale).with_for_update().first()
        if batch is None:
            raise MetadataError("source_changed")
        _rebase_batch(repo, batch, app_id, locale, revision)


def _rebase_batch(repo, batch, app_id, locale, revision):
    source = read_source(repo, app_id)
    same_source = (source.sha, source.path) == (batch.source_sha, batch.path)
    if revision != batch.revision and not (same_source and revision == source.revision):
        raise MetadataError("source_changed")
    if batch.source_content is None:
        return
    assert batch.content is not None
    pull = _batch_pull(repo, batch)
    generation = 0
    if same_source:
        if pull is None or pull.state == "open":
            try:
                read_translation_document(
                    repo,
                    source,
                    app_id,
                    locale,
                    batch.generation,
                    include_unpublished=True,
                    pull_number=_pull_number(batch.url) if batch.url else None,
                )
            except MetadataError as error:
                if str(error) != "source_changed":
                    raise
            else:
                batch.error = None
                batch.state = "queued" if batch.changes else "submitted"
                return
        generation = batch.generation + 1
    document = read_translation_document(repo, source, app_id, locale, generation)
    if not document.license:
        raise MetadataError("missing_license")
    previous = MetadataDocument(batch.source_content, app_id, locale)
    if same_source:
        document = previous.with_pending(document.content)
    queued = dict(batch.changes)
    merged_to_master = (
        pull is not None and pull.base.ref == SOURCE_BRANCH and pull.merged
    )
    if merged_to_master:
        _retain_omitted_edits(
            batch,
            previous,
            _reviewed_document(repo, pull, batch.path, app_id, locale),
        )
        saved_changes = {}
    else:
        saved_changes = _saved_edits(previous, batch.content, batch.published_ids)
        if pull is not None:
            reviewed = read_reviewed_fields(repo, batch.path, app_id, locale, pull)
            if reviewed is not None:
                try:
                    reviewed = previous.with_pending(reviewed.content)
                except MetadataError:
                    pass  # Match individually if the review also changed the source.
            if reviewed is not None:
                # Keep the reviewer's text before dropping the link to the closed PR.
                previously_translated = {
                    (u.field, u.context, u.source)
                    for u in previous.units()
                    if u.translation
                }
                wording = {
                    u.id: u.translation
                    for u in reviewed.units()
                    if u.translation
                    or u.id in batch.published_ids
                    or (u.field, u.context, u.source) in previously_translated
                }
                available = reconcile(reviewed, document, wording).satisfied
                _retain(
                    batch,
                    reconcile(
                        reviewed,
                        previous.with_pending(batch.content),
                        {k: v for k, v in wording.items() if k not in available},
                    ).retain,
                )
            omitted = _omitted_edits(
                previous,
                batch.content,
                reviewed,
                batch.changes,
                batch.published_ids,
            )
            _retain(batch, omitted)
            for unit in omitted:
                saved_changes.pop(unit.id, None)
            contested = reconcile(
                previous, reviewed, queued, expected=batch.publication_base
            ).retain
            _retain(batch, contested)
            for unit in contested:
                queued.pop(unit.id)
                saved_changes.pop(unit.id, None)
    result = reconcile(
        previous,
        document,
        {**saved_changes, **queued},
        expected=batch.publication_base if merged_to_master else None,
    )
    carried = result.apply
    output = document.content
    if carried:
        try:
            output = document.apply(carried)
        except MetadataError as error:
            if str(error) != "no_changes":
                raise
    _retain(batch, result.retain)
    # After a rebase, the same XPath can point to a different text.
    known = {}
    for old in previous.with_pending(batch.content).units():
        key = (old.field, old.context, old.source, old.translation)
        author = shared_unit(old, batch.field_edits).last_editor_id
        known[key] = author if key not in known else None
    rebased = (
        MetadataDocument(source.content, app_id, locale).with_pending(output).units()
    )
    identities = Counter((u.field, u.context, u.source, u.translation) for u in rebased)
    batch.field_edits = {
        u.id: {
            "version": uuid4().hex,
            "user_id": known[key],
            "fingerprint": _fingerprint(u),
            "unique": True,
        }
        for u in rebased
        if (key := (u.field, u.context, u.source, u.translation)) in known
        and known[key] is not None
        and identities[key] == 1
    }
    batch.revision = source.revision
    batch.source_sha = source.sha
    batch.path = source.path
    batch.source_content = source.content
    batch.content = output
    batch.changes = carried
    batch.publication_base = {k: document.nodes[k].unit.translation for k in carried}
    batch.missing_texts = sum(not u.translation.strip() for u in rebased)
    batch.state = "queued" if carried else "submitted"
    if not carried:
        batch.content = batch.source_content = batch.missing_texts = None
    batch.error = None
    batch.url = None
    batch.generation = generation
    batch.published_ids = []
    if pull is not None and pull.state == "open" and pull.base.ref == SOURCE_BRANCH:
        pull.edit(state="closed")


def dismiss_previous_translation(app_id, locale, translation):
    with get_db("writer") as db:
        batch = _query(db, app_id, locale).with_for_update().first()
        if batch is None:
            return []
        batch.previous_translations = [
            item for item in batch.previous_translations if item != translation
        ]
        return batch.previous_translations


def prune_translation_snapshots():
    if not config.settings.github_bot_token:
        return
    github = Github(config.settings.github_bot_token)
    now = datetime.now(UTC).replace(tzinfo=None)
    with get_db("writer") as db:
        keys = (
            db.query(
                MetadataTranslationBatch.app_id,
                MetadataTranslationBatch.locale,
            )
            .filter(
                MetadataTranslationBatch.state == "submitted",
                MetadataTranslationBatch.source_content.is_not(None),
                MetadataTranslationBatch.url.is_not(None),
                MetadataTranslationBatch.next_review_check.is_(None)
                | (MetadataTranslationBatch.next_review_check <= now),
            )
            .order_by(
                MetadataTranslationBatch.next_review_check.asc().nullsfirst(),
                MetadataTranslationBatch.app_id,
                MetadataTranslationBatch.locale,
            )
            .limit(100)
            .all()
        )
    for app_id, locale in keys:
        with get_db("writer") as db:
            batch = _query(db, app_id, locale).with_for_update(skip_locked=True).first()
            snapshot = _prunable_snapshot(batch)
            if snapshot is not None:
                batch.next_review_check = now + timedelta(hours=3)
        if snapshot is None:
            continue
        url, path, _, original, content, published_ids = snapshot
        try:
            repo = github.get_repo(f"flathub/{app_id}")
            pull = _recorded_pull(repo, url)
            if pull is not None and pull.base.ref != SOURCE_BRANCH:
                with get_db("writer") as db:
                    batch = (
                        _query(db, app_id, locale)
                        .with_for_update(skip_locked=True)
                        .first()
                    )
                    if _prunable_snapshot(batch) == snapshot:
                        batch.error = "source_changed"
                continue
            if pull is not None and not pull.merged:
                reviewed = (
                    read_reviewed_fields(repo, path, app_id, locale, pull)
                    if pull.state == "open"
                    else None
                )
                anchored = None
                if reviewed is not None:
                    try:
                        anchored = MetadataDocument(
                            original, app_id, locale
                        ).with_pending(reviewed.content)
                    except MetadataError:
                        pass
                with get_db("writer") as db:
                    batch = (
                        _query(db, app_id, locale)
                        .with_for_update(skip_locked=True)
                        .first()
                    )
                    if batch is not None and _prunable_snapshot(batch) == snapshot:
                        batch.next_review_check = now + (
                            timedelta(days=7)
                            if pull.state == "closed"
                            else timedelta(hours=3)
                        )
                        if pull.state == "closed":
                            batch.error = "pull_request_closed"
                        elif anchored is None:
                            batch.error = "source_changed"
                        else:
                            batch.error = None
                            if content != anchored.content:
                                _retain_omitted_edits(
                                    batch, anchored.anchored_to, anchored
                                )
                                batch.content = anchored.content
                                batch.missing_texts = sum(
                                    not u.translation.strip() for u in anchored.units()
                                )
                continue
            if pull is None or not pull.merged or not pull.merge_commit_sha:
                continue
            merged = merged_translation_content(repo, pull, path)
            reviewed = None
            if merged is not None and merged != content:
                try:
                    reviewed = MetadataDocument(merged, app_id, locale)
                except MetadataError:
                    # Keep the saved edits if we can't read the merged XML.
                    pass
            omitted = (
                _omitted_edits(
                    MetadataDocument(original, app_id, locale),
                    content,
                    reviewed,
                    (),
                    published_ids,
                )
                if merged != content
                else []
            )
        except (GithubException, MetadataError) as error:
            logger.warning("Could not check translation PR for %s: %s", app_id, error)
            continue
        with get_db("writer") as db:
            batch = _query(db, app_id, locale).with_for_update(skip_locked=True).first()
            if batch is None or _prunable_snapshot(batch) != snapshot:
                continue
            if omitted:
                _retain(batch, omitted)
            batch.source_content = None
            batch.content = None
            batch.error = None
            batch.missing_texts = None
            batch.published_ids = []


def _prunable_snapshot(batch):
    if (
        batch is None
        or batch.state != "submitted"
        or batch.changes
        or batch.source_content is None
        or batch.content is None
        or not batch.url
    ):
        return None
    return (
        batch.url,
        batch.path,
        batch.source_sha,
        batch.source_content,
        batch.content,
        tuple(batch.published_ids),
    )


@contextmanager
def _publication(app_id, locale, now):
    with get_db("writer") as db:
        batch = _query(db, app_id, locale).with_for_update(skip_locked=True).first()
        if (
            batch is not None
            and batch.changes
            and (
                batch.publishing_since is None
                or batch.publishing_since < now - timedelta(hours=1)
            )
        ):
            batch.publishing_since = now
            db.flush()
            db.expunge(batch)
        else:
            batch = None
    if batch is None:
        yield None
        return
    original = {
        col.key: getattr(batch, col.key)
        for col in batch.__table__.columns
        if col.key != "publication_attempt"
    }
    try:
        yield batch
    except Exception:
        with get_db("writer") as db:
            _query(db, app_id, locale).filter_by(publishing_since=now).update(
                {"publishing_since": None}, synchronize_session=False
            )
        raise
    with get_db("writer") as db:
        current = _query(db, app_id, locale).with_for_update().first()
        if current is None or current.publishing_since != now:
            return
        current.publishing_since = None
        if all(
            getattr(current, k) == v
            for k, v in original.items()
            if k != "publishing_since"
        ):
            for k, v in original.items():
                if getattr(batch, k) != v:
                    setattr(current, k, getattr(batch, k))
            if not current.changes:
                current.publication_attempt = {}
        elif (
            current.state == "queued"
            and batch.state == "submitted"
            and batch.error is None
            and batch.url
            and set(original["changes"]).issubset(batch.published_ids)
            and batch.previous_translations == original["previous_translations"]
            and (current.source_sha, current.generation)
            == (original["source_sha"], original["generation"])
        ):
            # A save arrived while GitHub was accepting the previous wording.
            # Compare that save against what we just published on the next run.
            current.url = batch.url
            current.publication_attempt = {}
            current.publication_base = {
                **current.publication_base,
                **{
                    k: v for k, v in original["changes"].items() if k in current.changes
                },
            }
            current.published_ids = sorted(
                set(current.published_ids).union(batch.published_ids)
            )


def _record_attempt(batch, branch, fields):
    with get_db("writer") as db:
        updated = (
            _query(db, batch.app_id, batch.locale)
            .filter_by(
                publishing_since=batch.publishing_since,
                source_sha=batch.source_sha,
                path=batch.path,
                generation=batch.generation,
            )
            .update(
                {"publication_attempt": {"branch": branch, "fields": fields}},
                synchronize_session=False,
            )
        )
        if not updated:
            raise MetadataError("source_changed")


def publish_translation_batches():
    if not config.settings.github_bot_token:
        return
    now = datetime.now(UTC).replace(tzinfo=None)
    with get_db("writer") as db:
        keys = (
            db.query(
                MetadataTranslationBatch.app_id,
                MetadataTranslationBatch.locale,
            )
            .filter(
                (MetadataTranslationBatch.state == "queued")
                | (
                    (MetadataTranslationBatch.state == "failed")
                    & (MetadataTranslationBatch.error == "pull_request_closed")
                    & (MetadataTranslationBatch.next_review_check <= now)
                )
                | (
                    (MetadataTranslationBatch.state == "failed")
                    & MetadataTranslationBatch.error.not_in(
                        ["source_changed", "pull_request_closed"]
                    )
                )
            )
            .all()
        )
    github = Github(config.settings.github_bot_token)
    for app_id, locale in keys:
        with _publication(
            app_id, locale, datetime.now(UTC).replace(tzinfo=None)
        ) as batch:
            if batch is None:
                continue
            try:
                repo = github.get_repo(f"flathub/{app_id}")
                # GitHub may have opened and merged the PR before we recorded its URL.
                recorded = _batch_pull(repo, batch)
                if recorded is not None:
                    batch.url = recorded.html_url
                    if recorded.merged and recorded.base.ref == SOURCE_BRANCH:
                        _rebase_batch(repo, batch, app_id, locale, batch.revision)
                        continue
                source = read_source(repo, app_id)
                if (source.sha, source.path) != (batch.source_sha, batch.path):
                    raise MetadataError("source_changed")
                branch = [source.sha, source.path, batch.generation]
                attempt = batch.publication_attempt
                result = submit_translation(
                    repo,
                    app_id,
                    locale,
                    source.revision,
                    batch.changes,
                    generation=batch.generation,
                    pull_number=_pull_number(batch.url) if batch.url else None,
                    source=source,
                    expected=batch.publication_base,
                    attempted=attempt.get("fields")
                    if attempt.get("branch") == branch
                    else None,
                    before_write=partial(_record_attempt, batch, branch),
                )
                if result.get("state") == "merged":
                    batch.url = result["url"]
                    _rebase_batch(repo, batch, app_id, locale, batch.revision)
                    continue
            except ReviewedFieldsChanged as conflict:
                document = conflict.document
                batch.url = conflict.url
                remaining = dict(batch.changes)
                _retain_omitted_edits(
                    batch,
                    MetadataDocument(batch.source_content, app_id, locale),
                    document,
                )
                _retain(
                    batch,
                    [
                        document.nodes[k].unit.model_copy(
                            update={"translation": remaining.pop(k)}
                        )
                        for k in conflict.fields
                    ],
                )
                batch.changes = remaining
                batch.publication_base = {
                    k: batch.publication_base[k] for k in remaining
                }
                batch.error = None
                batch.state = "queued" if remaining else "submitted"
                if not remaining and not batch.url:
                    _retain(batch, [document.nodes[k].unit for k in conflict.fields])
                    batch.source_content = batch.content = batch.missing_texts = None
                    batch.generation += 1
                    continue
                effective = {
                    k: v
                    for k, v in remaining.items()
                    if v != document.nodes[k].unit.translation
                }
                batch.content = (
                    document.apply(effective) if effective else document.content
                )
                batch.missing_texts = sum(
                    not u.translation.strip()
                    for u in MetadataDocument(batch.content, app_id, locale).units()
                )
            except (MetadataError, GithubException) as error:
                if isinstance(error, MetadataError) and str(error) == "no_changes":
                    batch.state = "submitted"
                    batch.error = None
                    batch.changes = {}
                    batch.publication_base = {}
                    if not batch.url:
                        batch.source_content = batch.content = None
                        batch.missing_texts = None
                    continue
                batch.state = "failed"
                if isinstance(error, ClosedTranslationPull):
                    batch.url = error.url
                batch.error = (
                    str(error)
                    if isinstance(error, MetadataError)
                    else "github_unavailable"
                )
                if batch.error == "pull_request_closed":
                    batch.next_review_check = now + timedelta(days=7)
                logger.warning(
                    "Translation batch failed for %s/%s: %s",
                    app_id,
                    locale,
                    batch.error,
                )
            else:
                batch.url = result["url"]
                batch.published_ids = sorted(
                    set(batch.published_ids).union(batch.changes)
                )
                batch.state = "submitted"
                batch.error = None
                batch.changes = {}
                batch.publication_base = {}
                batch.next_review_check = None

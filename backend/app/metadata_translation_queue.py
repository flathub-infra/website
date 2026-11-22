"""Index recipe-owned texts once for all language queues."""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from github import Github, GithubException
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.dialects.postgresql import insert

from . import config
from .database import get_db
from .metadata_translation_artifacts import PublishedListingUnavailable
from .metadata_translation_github import read_source
from .metadata_translations import (
    QUEUE_FIELDS,
    MetadataDocument,
    MetadataError,
    normalize_locale,
)
from .models import App, MetadataTranslationBatch, TranslationListing

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _MissingCounts:
    all_fields: dict[str, int]
    core_fields: dict[str, int]


def missing_counts(content: bytes, app_id: str) -> _MissingCounts:
    original = MetadataDocument(content, app_id, None)
    if not original.license:
        return _MissingCounts(all_fields={}, core_fields={})
    return _MissingCounts(
        all_fields=original.missing_counts(),
        core_fields=original.missing_counts(QUEUE_FIELDS),
    )


def _apps(db):
    return db.query(App.app_id).filter(
        App.type.in_(["desktop-application", "console-application"]),
        App.is_eol.is_(False),
    )


@dataclass(frozen=True)
class _ListingIndex:
    sha: str | None
    counts: _MissingCounts


def _write_listing(
    app_id: str, checked_at: datetime, index: _ListingIndex | None = None
):
    values = {"checked_at": checked_at, "index_write_id": uuid4().hex}
    if index is not None:
        values = {
            **values,
            "indexed_at": checked_at,
            "sha": index.sha,
            "missing": index.counts.all_fields,
            "missing_listing": index.counts.core_fields,
        }
    statement = insert(TranslationListing).values(app_id=app_id, **values)
    updates = {
        **{key: statement.excluded[key] for key in values},
        "checked_at": func.greatest(
            TranslationListing.checked_at, statement.excluded.checked_at
        ),
    }
    with get_db("writer") as db:
        db.execute(
            statement.on_conflict_do_update(
                index_elements=[TranslationListing.app_id],
                set_=updates,
                where=(
                    or_(
                        TranslationListing.indexed_at.is_(None),
                        TranslationListing.indexed_at <= statement.excluded.indexed_at,
                    )
                    if index is not None
                    else None
                ),
            )
        )


def refresh_index():
    if not config.settings.github_bot_token:
        return
    now = datetime.now(UTC).replace(tzinfo=None)
    with get_db("writer") as db:
        ids = (
            _apps(db)
            .outerjoin(TranslationListing, TranslationListing.app_id == App.app_id)
            .filter(
                or_(
                    TranslationListing.checked_at.is_(None),
                    (
                        TranslationListing.missing_listing.is_(None)
                        & (TranslationListing.checked_at < now - timedelta(hours=1))
                    ),
                    TranslationListing.checked_at < now - timedelta(days=7),
                    TranslationListing.checked_at < App.last_updated_at,
                )
            )
            .order_by(TranslationListing.checked_at.asc().nullsfirst(), App.app_id)
            .limit(12)
            .all()
        )
    with Github(config.settings.github_bot_token) as github:
        for (app_id,) in ids:
            sha = None
            try:
                source = read_source(github.get_repo(f"flathub/{app_id}"), app_id)
                sha = source.sha
                counts = missing_counts(source.content, app_id)
            except PublishedListingUnavailable:
                logger.warning("Could not verify published listing for %s", app_id)
                _write_listing(app_id, now)
                continue
            except MetadataError:
                counts = _MissingCounts(all_fields={}, core_fields={})
            except GithubException as error:
                if error.status != 404:
                    logger.warning(
                        "Could not index %s: GitHub %s", app_id, error.status
                    )
                    if error.status in (401, 429) or (
                        error.status == 403
                        and (
                            (error.headers or {}).get("x-ratelimit-remaining") == "0"
                            or "rate limit" in str(error).lower()
                        )
                    ):
                        return
                    # Defer this repository without discarding its last good index.
                    _write_listing(app_id, now)
                    continue
                counts = _MissingCounts(all_fields={}, core_fields={})
            _write_listing(app_id, now, _ListingIndex(sha, counts))


class QueueApp(BaseModel):
    app_id: str
    name: str


class TranslationQueue(BaseModel):
    apps: list[QueueApp]
    attention: list[QueueApp]
    indexing: bool


def language_queue(locale: str) -> TranslationQueue:
    locale = normalize_locale(locale)
    queue = TranslationQueue(apps=[], attention=[], indexing=False)
    with get_db("writer") as db:
        batches = {
            b.app_id: b
            for b in db.query(
                MetadataTranslationBatch.app_id,
                MetadataTranslationBatch.error,
                (
                    func.jsonb_array_length(
                        MetadataTranslationBatch.previous_translations
                    )
                    > 0
                ).label("recovered"),
                (MetadataTranslationBatch.changes != {}).label("pending"),
                MetadataTranslationBatch.source_sha,
                MetadataTranslationBatch.missing_texts,
                MetadataTranslationBatch.missing_listing_texts,
                MetadataTranslationBatch.listing_count_failed,
            ).filter_by(locale=locale)
        }
        rows = (
            _apps(db)
            .add_columns(
                App.appstream["name"].astext,
                TranslationListing.sha,
                TranslationListing.missing,
                TranslationListing.missing_listing,
            )
            .outerjoin(TranslationListing, TranslationListing.app_id == App.app_id)
            .order_by(App.last_updated_at.desc().nullslast(), App.app_id)
        )
        for app_id, name, sha, previous_counts, listing_counts in rows:
            item = QueueApp(app_id=app_id, name=name or app_id)
            batch = batches.pop(app_id, None)
            if listing_counts is None:
                queue.indexing = True
            counts = previous_counts if listing_counts is None else listing_counts
            if batch and (
                batch.error
                or batch.recovered
                or (
                    batch.pending
                    and (sha is not None or counts is not None)
                    and batch.source_sha != sha
                )
            ):
                queue.attention.append(item)
                continue
            needs_work = counts and counts.get(locale, counts.get("*", 0))
            if batch and (batch.source_sha == sha or counts is None):
                if batch.missing_listing_texts is not None:
                    needs_work = batch.missing_listing_texts
                elif batch.missing_texts is not None:
                    if listing_counts is None:
                        needs_work = batch.missing_texts
                    elif not batch.listing_count_failed:
                        queue.indexing = True
            if needs_work:
                queue.apps.append(item)
        queue.attention.extend(
            QueueApp(app_id=b.app_id, name=b.app_id)
            for b in batches.values()
            if b.pending or b.recovered or b.error
        )
    return queue

"""Index recipe-owned texts once for all language queues."""

import logging
from datetime import UTC, datetime, timedelta

from github import Github, GithubException
from pydantic import BaseModel
from sqlalchemy import func, or_

from . import config
from .database import get_db
from .metadata_translation_github import read_source
from .metadata_translations import (
    MetadataDocument,
    MetadataError,
    normalize_locale,
)
from .models import App, MetadataTranslationBatch, TranslationListing

logger = logging.getLogger(__name__)


def missing_counts(content: bytes, app_id: str):
    original = MetadataDocument(content, app_id, None)
    if not original.license:
        return {}
    return original.missing_counts()


def _apps(db):
    return db.query(App.app_id).filter(
        App.type.in_(["desktop-application", "console-application"]),
        App.is_eol.is_(False),
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
                missing = missing_counts(source.content, app_id)
            except MetadataError:
                missing = {}
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
                    with get_db("writer") as db:
                        row = db.get(TranslationListing, app_id)
                        if row is None:
                            row = TranslationListing(app_id=app_id)
                            db.add(row)
                        row.checked_at = now
                    continue
                missing = {}
            with get_db("writer") as db:
                db.merge(
                    TranslationListing(
                        app_id=app_id, sha=sha, checked_at=now, missing=missing
                    )
                )


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
            ).filter_by(locale=locale)
        }
        rows = (
            _apps(db)
            .add_columns(
                App.appstream["name"].astext,
                TranslationListing.sha,
                TranslationListing.missing,
            )
            .outerjoin(TranslationListing, TranslationListing.app_id == App.app_id)
            .order_by(App.app_id)
        )
        for app_id, name, sha, counts in rows:
            item = QueueApp(app_id=app_id, name=name or app_id)
            batch = batches.pop(app_id, None)
            if counts is None:
                queue.indexing = True
            if batch and (
                batch.error
                or batch.recovered
                or (batch.pending and counts is not None and batch.source_sha != sha)
            ):
                queue.attention.append(item)
                continue
            if (
                batch
                and batch.missing_texts is not None
                and (batch.source_sha == sha or counts is None)
            ):
                needs_work = batch.missing_texts
            else:
                needs_work = counts and counts.get(locale, counts.get("*", 0))
            if needs_work:
                queue.apps.append(item)
        queue.attention.extend(
            QueueApp(app_id=b.app_id, name=b.app_id)
            for b in batches.values()
            if b.pending or b.recovered or b.error
        )
    return queue

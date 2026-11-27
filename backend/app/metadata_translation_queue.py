"""Index recipe-owned texts once for all language queues."""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import uuid4

from github import Github, GithubException
from pydantic import BaseModel
from requests.exceptions import RequestException
from sqlalchemy import func, or_
from sqlalchemy.dialects.postgresql import insert

from . import config
from .database import get_db
from .metadata_translation_artifacts import PublishedListingUnavailable
from .metadata_translation_github import read_source
from .metadata_translation_target import (
    APPLICATION_TYPES,
    RecipeTarget,
    excluded_addon_ids,
)
from .metadata_translations import (
    QUEUE_FIELDS,
    MetadataDocument,
    MetadataError,
    normalize_locale,
)
from .models import (
    App,
    MetadataTranslationBatch,
    TranslationListing,
    TranslationListingCheck,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _MissingCounts:
    all_fields: dict[str, int]
    core_fields: dict[str, int]
    ambiguous_locales: tuple[str, ...] = ()


def missing_counts(content: bytes, app_id: str) -> _MissingCounts:
    original = MetadataDocument(content, app_id, None)
    if not original.license:
        return _MissingCounts(all_fields={}, core_fields={})
    return _MissingCounts(
        all_fields=original.missing_counts(),
        core_fields=original.missing_counts(QUEUE_FIELDS),
        ambiguous_locales=tuple(sorted(original.ambiguous_locales)),
    )


def _apps(db):
    return db.query(App.app_id).filter(
        App.type.in_((*APPLICATION_TYPES, "addon")),
        App.app_id.not_in(excluded_addon_ids()),
        App.is_eol.is_(False),
    )


@dataclass(frozen=True)
class _ListingIndex:
    sha: str | None
    counts: _MissingCounts


CheckOutcome = Literal[
    "indexed", "no_editable_metadata", "verification_failed", "github_error"
]


def _record_check(
    db,
    app_id,
    checked_at,
    outcome: CheckOutcome,
    http_status: int | None = None,
    ambiguous_locales: tuple[str, ...] = (),
):
    statement = insert(TranslationListingCheck).values(
        app_id=app_id,
        checked_at=checked_at,
        outcome=outcome,
        http_status=http_status,
        ambiguous_locales=ambiguous_locales,
    )
    db.execute(
        statement.on_conflict_do_update(
            index_elements=[TranslationListingCheck.app_id],
            set_={
                key: statement.excluded[key]
                for key in ("checked_at", "outcome", "http_status", "ambiguous_locales")
            },
            where=TranslationListingCheck.checked_at <= statement.excluded.checked_at,
        )
    )


def _write_listing(
    app_id: str,
    checked_at: datetime,
    index: _ListingIndex | None = None,
    *,
    outcome: CheckOutcome | None = None,
    http_status: int | None = None,
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
        if outcome is not None:
            _record_check(
                db,
                app_id,
                checked_at,
                outcome,
                http_status,
                index.counts.ambiguous_locales if index else (),
            )
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


def _due_for_check(now):
    return or_(
        TranslationListing.checked_at.is_(None),
        (
            TranslationListing.missing_listing.is_(None)
            & (TranslationListing.checked_at < now - timedelta(hours=1))
        ),
        TranslationListing.checked_at < now - timedelta(days=7),
        TranslationListing.checked_at < App.last_updated_at,
    )


def refresh_index():
    if not config.settings.github_bot_token:
        return
    batch_started_at = datetime.now(UTC).replace(tzinfo=None)
    with get_db("writer") as db:
        ids = (
            _apps(db)
            .add_columns(App.type, App.appstream["bundle"])
            .outerjoin(TranslationListing, TranslationListing.app_id == App.app_id)
            .filter(_due_for_check(batch_started_at))
            .order_by(TranslationListing.checked_at.asc().nullsfirst(), App.app_id)
            .limit(12)
            .all()
        )
    with Github(config.settings.github_bot_token) as github:
        for app_id, app_type, bundle in ids:
            http_status = None
            sha = None
            try:
                with get_db("writer") as db:
                    target = RecipeTarget.for_app(
                        db, app_id, app_type, {"bundle": bundle}
                    )
                source = read_source(target.open(github, discover=True), app_id)
                sha = source.sha
                counts = missing_counts(source.content, app_id)
                outcome: CheckOutcome = (
                    "indexed"
                    if counts.all_fields.get("*", 0)
                    else "no_editable_metadata"
                )
            except PublishedListingUnavailable:
                logger.warning("Could not verify published listing for %s", app_id)
                _write_listing(app_id, batch_started_at, outcome="verification_failed")
                continue
            except RequestException:
                with get_db("writer") as db:
                    _record_check(db, app_id, batch_started_at, "github_error")
                raise
            except MetadataError:
                outcome = "no_editable_metadata"
                counts = _MissingCounts(all_fields={}, core_fields={})
            except GithubException as error:
                http_status = error.status
                outcome = "github_error"
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
                        with get_db("writer") as db:
                            _record_check(
                                db, app_id, batch_started_at, outcome, http_status
                            )
                        return
                    # Defer this repository without discarding its last good index.
                    _write_listing(
                        app_id,
                        batch_started_at,
                        outcome=outcome,
                        http_status=http_status,
                    )
                    continue
                counts = _MissingCounts(all_fields={}, core_fields={})
            _write_listing(
                app_id,
                batch_started_at,
                _ListingIndex(sha, counts),
                outcome=outcome,
                http_status=http_status,
            )


class QueueApp(BaseModel):
    app_id: str
    name: str


class TranslationQueue(BaseModel):
    apps: list[QueueApp]
    attention: list[QueueApp]
    indexing: bool
    first_checks_pending: bool


class TranslationIndexStatus(BaseModel):
    eligible_apps: int
    never_checked: int
    due_for_recheck: int


def translation_index_status() -> TranslationIndexStatus:
    checked = TranslationListing.checked_at
    due = _due_for_check(datetime.now(UTC).replace(tzinfo=None))
    with get_db("writer") as db:
        eligible, unchecked, rechecks = (
            _apps(db)
            .outerjoin(TranslationListing, TranslationListing.app_id == App.app_id)
            .with_entities(
                func.count(),
                func.count().filter(checked.is_(None)),
                func.count().filter(checked.is_not(None), due),
            )
            .one()
        )
    return TranslationIndexStatus(
        eligible_apps=eligible, never_checked=unchecked, due_for_recheck=rechecks
    )


class TranslationLookup(BaseModel):
    eligibility: Literal["eligible", "eol", "excluded", "unknown"]
    checked_at: datetime | None
    outcome: CheckOutcome | Literal["ambiguous_translations"] | None
    http_status: int | None
    queue_state: Literal["listed", "attention", "absent"]
    missing: int | None


def lookup_translation(app_id: str, locale: str) -> TranslationLookup:
    locale = normalize_locale(locale)
    with get_db("writer", repeatable_read=True) as db:
        row = (
            db.query(
                App.is_eol,
                func.greatest(
                    TranslationListing.checked_at, TranslationListingCheck.checked_at
                ).label("checked_at"),
                TranslationListingCheck.checked_at.label("outcome_at"),
                TranslationListingCheck.outcome,
                TranslationListingCheck.http_status,
                TranslationListingCheck.ambiguous_locales,
            )
            .outerjoin(TranslationListing, TranslationListing.app_id == App.app_id)
            .outerjoin(
                TranslationListingCheck, TranslationListingCheck.app_id == App.app_id
            )
            .filter(App.app_id == app_id)
            .one_or_none()
        )
        if row is None:
            eligibility = "unknown"
        elif row.is_eol:
            eligibility = "eol"
        elif _apps(db).filter(App.app_id == app_id).first():
            eligibility = "eligible"
        else:
            eligibility = "excluded"
        queue, missing = _language_queue(db, locale, app_id)
    latest = row is not None and row.checked_at == row.outcome_at
    outcome = row.outcome if latest else None
    if outcome == "indexed" and locale in (row.ambiguous_locales or ()):
        outcome = "ambiguous_translations"
    return TranslationLookup(
        eligibility=eligibility,
        checked_at=row.checked_at.replace(tzinfo=UTC)
        if row and row.checked_at
        else None,
        outcome=outcome,
        http_status=row.http_status if latest else None,
        queue_state="attention"
        if queue.attention
        else "listed"
        if queue.apps
        else "absent",
        missing=missing,
    )


def language_queue(locale: str) -> TranslationQueue:
    with get_db("writer") as db:
        queue, _ = _language_queue(db, normalize_locale(locale))
        return queue


def _language_queue(db, locale, lookup_id=None):
    queue = TranslationQueue(
        apps=[], attention=[], indexing=False, first_checks_pending=False
    )
    missing = None
    batch_query = db.query(
        MetadataTranslationBatch.app_id,
        MetadataTranslationBatch.error,
        (
            func.jsonb_array_length(MetadataTranslationBatch.previous_translations) > 0
        ).label("recovered"),
        (MetadataTranslationBatch.changes != {}).label("pending"),
        MetadataTranslationBatch.source_sha,
        MetadataTranslationBatch.missing_texts,
        MetadataTranslationBatch.missing_listing_texts,
        MetadataTranslationBatch.listing_count_failed,
    ).filter(
        MetadataTranslationBatch.locale == locale,
        MetadataTranslationBatch.app_id.not_in(excluded_addon_ids()),
    )
    if lookup_id is not None:
        batch_query = batch_query.filter(MetadataTranslationBatch.app_id == lookup_id)
    batches = {b.app_id: b for b in batch_query}
    apps = _apps(db)
    if lookup_id is not None:
        apps = apps.filter(App.app_id == lookup_id)
    rows = (
        apps.add_columns(
            App.appstream["name"].astext,
            TranslationListing.sha,
            TranslationListing.missing,
            TranslationListing.missing_listing,
            TranslationListing.checked_at.is_(None).label("unchecked"),
        )
        .outerjoin(TranslationListing, TranslationListing.app_id == App.app_id)
        .order_by(App.last_updated_at.desc().nullslast(), App.app_id)
    )
    for app_id, name, sha, previous_counts, listing_counts, unchecked in rows:
        item = QueueApp(app_id=app_id, name=name or app_id)
        batch = batches.pop(app_id, None)
        if unchecked:
            queue.first_checks_pending = True
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
        if lookup_id is not None and isinstance(needs_work, int):
            missing = needs_work
    queue.attention.extend(
        QueueApp(app_id=b.app_id, name=b.app_id)
        for b in batches.values()
        if b.pending or b.recovered or b.error
    )
    return queue, missing

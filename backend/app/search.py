import json
import logging
import re
import time
from typing import Any, Literal, TypeVar

import meilisearch
import meilisearch.errors
from pydantic import BaseModel, field_validator
from sqlalchemy import text

from app.models import ConnectedAccountProvider

from . import config, schemas, search_health, search_index
from .database import get_db
from .search_tasks import monitor_hybrid_index_task
from .verification_method import VerificationMethod

T = TypeVar("T")
logger = logging.getLogger(__name__)

ALLOWED_TRANSLATION_KEYS = {"name", "summary", "description", "keywords"}

LEXICAL_APPS_INDEX = "apps"
HYBRID_APPS_INDEX = "apps-hybrid"

FILTERABLE_ATTRIBUTES = search_index.FILTERABLE_ATTRIBUTES
RANKING_RULES = search_index.RANKING_RULES
SEARCHABLE_ATTRIBUTES = search_index.SEARCHABLE_ATTRIBUTES
SORTABLE_ATTRIBUTES = search_index.SORTABLE_ATTRIBUTES


class MeilisearchResponse[T](BaseModel):
    hits: list[T]
    query: str
    processingTimeMs: int
    hitsPerPage: int
    page: int
    totalPages: int
    totalHits: int
    facetDistribution: dict[str, dict[str, int]] | None = None
    facetStats: dict[str, dict[str, int]] | None = None


class MeilisearchResponseLimited[T](BaseModel):
    hits: list[T]
    query: str
    processingTimeMs: int
    limit: int
    offset: int
    estimatedTotalHits: int
    facetDistribution: dict[str, dict[str, int]] | None = None
    facetStats: dict[str, dict[str, int]] | None = None


class AppsIndex(BaseModel):
    name: str
    keywords: list[str] | None = None
    localized_keywords: list[str] | None = None
    summary: str
    description: str
    id: str
    type: str
    translations: dict[str, dict[str, str | list[str]]] | None = None
    project_license: str
    is_free_license: bool
    app_id: str
    icon: str | None
    main_categories: schemas.MainCategory | list[schemas.MainCategory]
    sub_categories: list[str] | None = None
    developer_name: str | None
    verification_verified: bool
    verification_method: VerificationMethod
    verification_login_name: str | None
    verification_login_provider: ConnectedAccountProvider | None
    verification_login_is_organization: bool | None
    verification_website: str | None
    verification_timestamp: str | None
    runtime: str | None
    updated_at: int
    arches: list[str] | None
    added_at: int | None = None
    trending: float | None = None
    installs_last_month: int | None = None
    favorites_count: int | None = None
    isMobileFriendly: bool

    # Custom validator to map None to the Enum 'NONE'
    @field_validator("verification_method", mode="before")
    def map_none_to_enum(cls, v: str | None):
        if v is None:
            return VerificationMethod.NONE

        # map rest to enum - returns a keyerror
        return VerificationMethod[v.upper()]


class Filter(BaseModel):
    filterType: str
    value: str


class SearchQuery(BaseModel):
    query: str
    filters: list[Filter] | None = None
    hits_per_page: int = 21
    page: int = 1

    @field_validator("hits_per_page")
    def validate_hits_per_page(cls, v: int):
        if v < 1:
            raise ValueError("hits_per_page must be at least 1")
        if v > 1000:
            raise ValueError("hits_per_page cannot exceed 1000")
        return v

    @field_validator("page")
    def validate_page(cls, v: int):
        if v < 1:
            raise ValueError("page must be at least 1")
        return v


def _configure_meilisearch_index(
    meilisearch_client: Any, index_uid: str = LEXICAL_APPS_INDEX
) -> None:
    meilisearch_client.create_index(index_uid, {"primaryKey": "id"})
    index = meilisearch_client.index(index_uid)
    index.update_pagination_settings({"maxTotalHits": 10000})
    search_index.configure_index(index)


client = meilisearch.Client(
    config.settings.meilisearch_url, config.settings.meilisearch_key
)

_configure_meilisearch_index(client)
_configure_meilisearch_index(client, HYBRID_APPS_INDEX)


def _translate_name_and_summary[
    U: (
        MeilisearchResponse,
        MeilisearchResponseLimited,
    )
](locale: str, searchResults: U):
    fallbackLocale = locale.split("-")[0]

    for searchResult in searchResults.hits:
        picked_locale = None

        if searchResult.translations:
            if locale in searchResult.translations:
                picked_locale = locale
            elif fallbackLocale in searchResult.translations:
                picked_locale = fallbackLocale

            if picked_locale:
                if "name" in searchResult.translations[picked_locale]:
                    searchResult.name = searchResult.translations[picked_locale]["name"]

                if "summary" in searchResult.translations[picked_locale]:
                    searchResult.summary = searchResult.translations[picked_locale][
                        "summary"
                    ]

                if "description" in searchResult.translations[picked_locale]:
                    searchResult.description = searchResult.translations[picked_locale][
                        "description"
                    ]

                if "keywords" in searchResult.translations[picked_locale]:
                    searchResult.keywords = searchResult.translations[picked_locale][
                        "keywords"
                    ]

            # Always delete translations from the response, regardless of whether a locale match was found
            del searchResult.translations

    return searchResults


def _sanitize_string(value: str) -> str:
    # Drop invalid unicode code points that cannot be encoded in UTF-8.
    return value.encode("utf-8", errors="ignore").decode("utf-8")


def _sanitize_string_list(value: list[Any]) -> list[str]:
    clean_values = []

    for item in value:
        if not isinstance(item, str):
            continue

        clean_item = _sanitize_string(item)
        if clean_item:
            clean_values.append(clean_item)

    return clean_values


def _normalize_translation_value(value: Any) -> dict[str, str | list[str]] | None:
    normalized_value = value
    if isinstance(normalized_value, str):
        stripped = normalized_value.strip()
        if stripped.startswith("{"):
            try:
                normalized_value = json.loads(stripped)
            except json.JSONDecodeError:
                return None
        else:
            return None

    if not isinstance(normalized_value, dict):
        return None

    clean_translation = {}
    for key, key_value in normalized_value.items():
        if key not in ALLOWED_TRANSLATION_KEYS:
            continue

        if key == "keywords":
            if isinstance(key_value, list):
                clean_keywords = _sanitize_string_list(key_value)
                if clean_keywords:
                    clean_translation[key] = clean_keywords
            continue

        if isinstance(key_value, str):
            clean_value = _sanitize_string(key_value)
            if clean_value:
                clean_translation[key] = clean_value

    if not clean_translation:
        return None

    return clean_translation


def _sanitize_translations(
    value: Any,
) -> dict[str, dict[str, str | list[str]]]:
    if not isinstance(value, dict):
        return {}

    clean_translations = {}
    for locale, translation in value.items():
        if not isinstance(locale, str):
            continue

        clean_translation = _normalize_translation_value(translation)
        if clean_translation:
            clean_locale = _sanitize_string(locale)
            if clean_locale:
                clean_translations[clean_locale] = clean_translation

    return clean_translations


def _validate_json_safe(document: dict[str, Any]) -> tuple[bool, str | None]:
    try:
        # `allow_nan=False` keeps payload strict-JSON (Meilisearch rejects NaN/Infinity).
        json.dumps(document, ensure_ascii=False, allow_nan=False)
    except (TypeError, ValueError, OverflowError, UnicodeError) as err:
        return False, str(err)

    return True, None


def _sanitize_index_document(
    document: dict[str, Any],
) -> tuple[dict[str, Any] | None, str | None]:
    if not isinstance(document, dict):
        return None, "document is not a dictionary"

    clean_document = dict(document)

    document_id = clean_document.get("id")
    if not isinstance(document_id, str) or not document_id.strip():
        return None, "missing or invalid `id`"
    clean_document["id"] = _sanitize_string(document_id)
    if not clean_document["id"]:
        return None, "missing or invalid `id`"

    if "translations" in clean_document:
        clean_translations = _sanitize_translations(clean_document["translations"])
        if clean_translations:
            clean_document["translations"] = clean_translations
        else:
            clean_document.pop("translations", None)

    if "keywords" in clean_document:
        keywords = clean_document["keywords"]
        if isinstance(keywords, list):
            clean_keywords = _sanitize_string_list(keywords)
            if clean_keywords:
                clean_document["keywords"] = clean_keywords
            else:
                clean_document.pop("keywords", None)
        elif keywords is not None:
            clean_document.pop("keywords", None)

    json_safe, reason = _validate_json_safe(clean_document)
    if not json_safe:
        return None, f"document is not JSON-safe: {reason}"

    return clean_document, None


def _get_doc_identifier(document: dict[str, Any]) -> str:
    if isinstance(document.get("app_id"), str):
        return document["app_id"]
    if isinstance(document.get("id"), str):
        return document["id"]
    return "<unknown>"


def _update_documents_with_fallback(
    index: Any, documents: list[dict[str, Any]]
) -> tuple[
    int,
    list[tuple[dict[str, Any], str]],
    list[tuple[Any, list[dict[str, Any]]]],
]:
    if not documents:
        return 0, [], []

    try:
        task = index.update_documents(documents)
        return len(documents), [], [(task, documents)]
    except meilisearch.errors.MeilisearchApiError as err:
        if len(documents) == 1:
            return 0, [(documents[0], str(err))], []

        midpoint = len(documents) // 2
        accepted_left, skipped_left, tasks_left = _update_documents_with_fallback(
            index, documents[:midpoint]
        )
        accepted_right, skipped_right, tasks_right = _update_documents_with_fallback(
            index, documents[midpoint:]
        )
        return (
            accepted_left + accepted_right,
            skipped_left + skipped_right,
            tasks_left + tasks_right,
        )


def _queue_hybrid_task(operation: Literal["update", "delete"], task: Any) -> bool:
    task_uid = getattr(task, "task_uid", None)
    if task_uid is None:
        search_health.mark_hybrid_task_failed("unknown")
        logger.error(
            "Hybrid Meilisearch task was returned without a task identifier",
            extra={"operation": operation},
        )
        return False

    try:
        monitor_hybrid_index_task.send(operation, task_uid)
    except Exception:
        search_health.mark_hybrid_task_failed(task_uid)
        logger.exception(
            "Unable to queue hybrid Meilisearch task monitor",
            extra={"task": task_uid, "operation": operation},
        )
        return False
    return True


def create_or_update_apps(apps_to_update: list[dict]):
    sanitized_documents = []
    skipped_for_sanitization = []

    for document in apps_to_update:
        clean_document, reason = _sanitize_index_document(document)
        if clean_document:
            sanitized_documents.append(clean_document)
            continue

        skipped_for_sanitization.append((document, reason or "unknown reason"))

    for document, reason in skipped_for_sanitization:
        logger.warning(
            "Skipping Meilisearch document %s during sanitization: %s",
            _get_doc_identifier(document),
            reason,
        )

    if not sanitized_documents:
        logger.info(
            "Meilisearch index update skipped: total=%d queued=0 skipped=%d",
            len(apps_to_update),
            len(skipped_for_sanitization),
        )
        return

    with search_health.hybrid_mutation_lock():
        queued_count, skipped_for_meili, lexical_tasks = (
            _update_documents_with_fallback(
                client.index(LEXICAL_APPS_INDEX), sanitized_documents
            )
        )
        search_health.record_lexical_mutation(
            [task.task_uid for task, _ in lexical_tasks]
        )

        for document, reason in skipped_for_meili:
            logger.warning(
                "Skipping Meilisearch document %s due to Meilisearch error: %s",
                _get_doc_identifier(document),
                reason,
            )

        try:
            (
                hybrid_queued_count,
                skipped_for_hybrid,
                hybrid_tasks,
            ) = _update_documents_with_fallback(
                client.index(HYBRID_APPS_INDEX), sanitized_documents
            )
            for document, reason in skipped_for_hybrid:
                logger.warning(
                    "Skipping hybrid Meilisearch document %s due to Meilisearch error: %s",
                    _get_doc_identifier(document),
                    reason,
                )
            if skipped_for_hybrid:
                search_health.mark_hybrid_task_failed("synchronous")

            monitor_failures = sum(
                not _queue_hybrid_task("update", task) for task, _ in hybrid_tasks
            )
            logger.info(
                "Hybrid Meilisearch index update queued: total=%d queued=%d skipped=%d monitor_failures=%d",
                len(sanitized_documents),
                hybrid_queued_count,
                len(skipped_for_hybrid),
                monitor_failures,
            )
        except Exception:
            search_health.mark_hybrid_task_failed("synchronous")
            logger.exception("Hybrid Meilisearch index update failed")

    logger.info(
        "Meilisearch index update queued: total=%d queued=%d skipped=%d",
        len(apps_to_update),
        queued_count,
        len(skipped_for_sanitization) + len(skipped_for_meili),
    )


def delete_apps(app_id_list: list[str]) -> None:
    if len(app_id_list) > 0:
        with search_health.hybrid_mutation_lock():
            lexical_task = client.index(LEXICAL_APPS_INDEX).delete_documents(
                app_id_list
            )
            search_health.record_lexical_mutation([lexical_task.task_uid])
            try:
                task = client.index(HYBRID_APPS_INDEX).delete_documents(app_id_list)
                _queue_hybrid_task("delete", task)
            except Exception:
                search_health.mark_hybrid_task_failed("synchronous")
                logger.exception("Hybrid Meilisearch index delete failed")


def get_by_selected_categories(
    selected_categories: list[schemas.MainCategory],
    exclude_subcategories: list[str] | None,
    page: int | None,
    hits_per_page: int | None,
    locale: str,
    sort_by: schemas.SortBy | None = None,
) -> MeilisearchResponse[AppsIndex]:
    category_list = [
        f"main_categories = {category.value}" for category in selected_categories
    ]

    exclude_subcategories_list = (
        [
            f"sub_categories NOT IN [{exclude_subcategory}]"
            for exclude_subcategory in exclude_subcategories
        ]
        if exclude_subcategories
        else []
    )

    return _translate_name_and_summary(
        locale,
        MeilisearchResponse[AppsIndex].model_validate(
            client.index(LEXICAL_APPS_INDEX).search(
                "",
                {
                    "filter": [
                        category_list,
                        *exclude_subcategories_list,
                        "type IN [console-application, desktop-application]",
                        "NOT icon IS NULL",
                    ],
                    "sort": (
                        [f"{sort_by.value}:desc"]
                        if sort_by
                        else ["installs_last_month:desc"]
                    ),
                    "hitsPerPage": hits_per_page or 250,
                    "page": page or 1,
                },
            )
        ),
    )


def get_by_selected_category_and_subcategory(
    selected_category: schemas.MainCategory,
    selected_subcategory: list[str],
    exclude_subcategories: list[str] | None,
    page: int | None,
    hits_per_page: int | None,
    locale: str,
    sort_by: schemas.SortBy | None = None,
) -> MeilisearchResponse[AppsIndex]:
    selected_subcategory_list = [
        f"sub_categories = {subcategory}" for subcategory in selected_subcategory
    ]

    exclude_subcategories_list = (
        [
            f"sub_categories NOT IN [{exclude_subcategory}]"
            for exclude_subcategory in exclude_subcategories
            if exclude_subcategory is not None
        ]
        if exclude_subcategories
        else []
    )

    return _translate_name_and_summary(
        locale,
        MeilisearchResponse[AppsIndex].model_validate(
            client.index(LEXICAL_APPS_INDEX).search(
                "",
                {
                    "filter": [
                        f"main_categories = {selected_category.value}",
                        selected_subcategory_list,
                        *exclude_subcategories_list,
                        "type IN [console-application, desktop-application]",
                        "NOT icon IS NULL",
                    ],
                    "sort": (
                        [f"{sort_by.value}:desc"]
                        if sort_by
                        else ["installs_last_month:desc"]
                    ),
                    "hitsPerPage": hits_per_page or 250,
                    "page": page or 1,
                },
            ),
        ),
    )


def get_by_installs_last_month(
    page: int | None, hits_per_page: int | None, locale: str
) -> MeilisearchResponse[AppsIndex]:
    return _translate_name_and_summary(
        locale,
        MeilisearchResponse[AppsIndex].model_validate(
            client.index(LEXICAL_APPS_INDEX).search(
                "",
                {
                    "sort": ["installs_last_month:desc"],
                    "hitsPerPage": hits_per_page or 250,
                    "page": page or 1,
                    "filter": [
                        "type IN [console-application, desktop-application]",
                        "NOT icon IS NULL",
                    ],
                },
            ),
        ),
    )


def get_by_trending(
    page: int | None, hits_per_page: int | None, locale: str
) -> MeilisearchResponse[AppsIndex]:
    return _translate_name_and_summary(
        locale,
        MeilisearchResponse[AppsIndex].model_validate(
            client.index(LEXICAL_APPS_INDEX).search(
                "",
                {
                    "sort": ["trending:desc"],
                    "hitsPerPage": hits_per_page or 250,
                    "page": page or 1,
                    "filter": [
                        "type IN [console-application, desktop-application]",
                        "NOT icon IS NULL",
                    ],
                },
            ),
        ),
    )


def get_by_added_at(
    page: int | None, hits_per_page: int | None, locale: str
) -> MeilisearchResponse[AppsIndex]:
    return _translate_name_and_summary(
        locale,
        MeilisearchResponse[AppsIndex].model_validate(
            client.index(LEXICAL_APPS_INDEX).search(
                "",
                {
                    "sort": ["added_at:desc"],
                    "hitsPerPage": hits_per_page or 250,
                    "page": page or 1,
                    "filter": [
                        "type IN [console-application, desktop-application]",
                        "NOT icon IS NULL",
                    ],
                },
            ),
        ),
    )


def get_by_updated_at(
    page: int | None, hits_per_page: int | None, locale: str
) -> MeilisearchResponse[AppsIndex]:
    return _translate_name_and_summary(
        locale,
        MeilisearchResponse[AppsIndex].model_validate(
            client.index(LEXICAL_APPS_INDEX).search(
                "",
                {
                    "sort": ["updated_at:desc"],
                    "hitsPerPage": hits_per_page or 250,
                    "page": page or 1,
                    "filter": [
                        "type IN [console-application, desktop-application]",
                        "NOT icon IS NULL",
                    ],
                },
            ),
        ),
    )


def get_by_verified(
    page: int | None, hits_per_page: int | None, locale: str
) -> MeilisearchResponse[AppsIndex]:
    return _translate_name_and_summary(
        locale,
        MeilisearchResponse[AppsIndex].model_validate(
            client.index(LEXICAL_APPS_INDEX).search(
                "",
                {
                    "filter": [
                        "verification_verified = true",
                        "type IN [console-application, desktop-application]",
                        "NOT icon IS NULL",
                    ],
                    "sort": ["verification_timestamp:desc"],
                    "hitsPerPage": hits_per_page or 250,
                    "page": page or 1,
                },
            ),
        ),
    )


def get_by_favorites_count(
    page: int | None, hits_per_page: int | None, locale: str
) -> MeilisearchResponse[AppsIndex]:
    return _translate_name_and_summary(
        locale,
        MeilisearchResponse[AppsIndex].model_validate(
            client.index(LEXICAL_APPS_INDEX).search(
                "",
                {
                    "filter": [
                        "type IN [console-application, desktop-application]",
                        "NOT icon IS NULL",
                    ],
                    "sort": ["favorites_count:desc", "updated_at:asc"],
                    "hitsPerPage": hits_per_page or 250,
                    "page": page or 1,
                },
            ),
        ),
    )


def get_by_mobile(
    page: int | None, hits_per_page: int | None, locale: str
) -> MeilisearchResponse[AppsIndex]:
    return _translate_name_and_summary(
        locale,
        MeilisearchResponse[AppsIndex].model_validate(
            client.index(LEXICAL_APPS_INDEX).search(
                "",
                {
                    "filter": [
                        "isMobileFriendly = true",
                        "type IN [console-application, desktop-application]",
                        "NOT icon IS NULL",
                    ],
                    "sort": ["trending:desc"],
                    "hitsPerPage": hits_per_page or 250,
                    "page": page or 1,
                },
            ),
        ),
    )


def get_by_developer(
    developer: str, page: int | None, hits_per_page: int | None, locale: str
) -> MeilisearchResponse[AppsIndex]:
    escaped_developer = (
        developer.replace("'", "\\'").replace('"', '\\"').replace("/", "\\/")
    )

    return _translate_name_and_summary(
        locale,
        MeilisearchResponse[AppsIndex].model_validate(
            client.index(LEXICAL_APPS_INDEX).search(
                "",
                {
                    "filter": [
                        f"developer_name = '{escaped_developer}'",
                        "type IN [console-application, desktop-application]",
                        "NOT icon IS NULL",
                    ],
                    "sort": ["installs_last_month:desc"],
                    "hitsPerPage": hits_per_page or 250,
                    "page": page or 1,
                },
            ),
        ),
    )


def get_by_keyword(
    keyword: str, page: int | None, hits_per_page: int | None, locale: str
) -> MeilisearchResponse[AppsIndex]:
    escaped_keyword = (
        keyword.replace("'", "\\'").replace('"', '\\"').replace("/", "\\/")
    )

    return _translate_name_and_summary(
        locale,
        MeilisearchResponse[AppsIndex].model_validate(
            client.index(LEXICAL_APPS_INDEX).search(
                "",
                {
                    "filter": [
                        f"localized_keywords = '{escaped_keyword}'",
                        "type IN [console-application, desktop-application]",
                        "NOT icon IS NULL",
                    ],
                    "sort": ["installs_last_month:desc"],
                    "hitsPerPage": hits_per_page or 250,
                    "page": page or 1,
                },
            ),
        ),
    )


def _search_apps_options(searchquery: SearchQuery) -> dict[str, Any]:
    filters = []
    filtering_for_type = False
    filtering_for_desktop_or_console = False

    for filter in searchquery.filters or []:
        if filter.filterType == "type":
            filtering_for_type = True
            if filter.value in {"desktop-application", "console-application"}:
                filtering_for_desktop_or_console = True

        filters.append(f"{filter.filterType} = '{filter.value}'")

    if not filtering_for_type and not filtering_for_desktop_or_console:
        filters.append("type IN [desktop-application, console-application]")

    if not (filtering_for_type and not filtering_for_desktop_or_console):
        filters.append("NOT icon IS NULL")

    filter_string = " AND ".join(filters)
    return {
        "hitsPerPage": searchquery.hits_per_page or 250,
        "page": searchquery.page or 1,
        "sort": ["installs_last_month:desc"],
        "filter": filter_string if filter_string else None,
        "facets": [
            "verification_verified",
            "main_categories",
            "is_free_license",
            "type",
            "arches",
        ],
    }


def _is_app_id_query(query: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){2,}", query.strip()))


def _is_hybrid_candidate(searchquery: SearchQuery) -> bool:
    if not searchquery.query.strip() or _is_app_id_query(searchquery.query):
        return False

    type_values = [
        filter.value
        for filter in searchquery.filters or []
        if filter.filterType == "type"
    ]
    return all(
        type_value in {"desktop-application", "console-application"}
        for type_value in type_values
    )


def _search_error_code(error: Exception) -> str | int | None:
    return getattr(error, "code", None) or getattr(error, "status_code", None)


def _log_search_timing(
    response: MeilisearchResponse[AppsIndex],
    mode: str,
    started_at: float,
    fallback_error_code: str | int | None = None,
) -> None:
    end_to_end_duration_ms = (time.perf_counter() - started_at) * 1000
    logger.info(
        "Meilisearch app search",
        extra={
            "search_mode": mode,
            "semantic_ratio": config.settings.search_hybrid_semantic_ratio,
            "processing_time_ms": response.processingTimeMs,
            "end_to_end_duration_ms": end_to_end_duration_ms,
            "result_count": len(response.hits),
            "fallback_error_code": fallback_error_code,
        },
    )


def search_apps_post(
    searchquery: SearchQuery, locale: str
) -> MeilisearchResponse[AppsIndex]:
    options = _search_apps_options(searchquery)
    hybrid_candidate = config.settings.search_hybrid_enabled and _is_hybrid_candidate(
        searchquery
    )
    started_at = time.perf_counter()
    mode = "lexical"
    fallback_error_code = None

    if hybrid_candidate and search_health.has_hybrid_task_failures():
        logger.warning(
            "Hybrid Meilisearch index has failed tasks; using lexical fallback"
        )
        raw_response = client.index(LEXICAL_APPS_INDEX).search(
            searchquery.query, options
        )
        mode = "hybrid_unhealthy_fallback"
        fallback_error_code = "index_unhealthy"
    elif hybrid_candidate:
        hybrid_options = {
            **options,
            "hybrid": {
                "embedder": config.settings.search_hybrid_embedder,
                "semanticRatio": config.settings.search_hybrid_semantic_ratio,
            },
        }
        try:
            raw_response = client.index(HYBRID_APPS_INDEX).search(
                searchquery.query, hybrid_options
            )
            mode = "hybrid"
        except (
            meilisearch.errors.MeilisearchApiError,
            meilisearch.errors.MeilisearchCommunicationError,
            meilisearch.errors.MeilisearchTimeoutError,
        ) as error:
            fallback_error_code = _search_error_code(error)
            elapsed_ms = (time.perf_counter() - started_at) * 1000
            logger.warning(
                "Hybrid Meilisearch search failed",
                extra={
                    "search_mode": "hybrid_fallback",
                    "embedder": config.settings.search_hybrid_embedder,
                    "status": getattr(error, "status_code", None),
                    "error_code": fallback_error_code,
                    "elapsed_ms": elapsed_ms,
                },
            )
            raw_response = client.index(LEXICAL_APPS_INDEX).search(
                searchquery.query, options
            )
            mode = "hybrid_fallback"
    else:
        raw_response = client.index(LEXICAL_APPS_INDEX).search(
            searchquery.query, options
        )

    response = _translate_name_and_summary(
        locale,
        MeilisearchResponse[AppsIndex].model_validate(raw_response),
    )
    _log_search_timing(response, mode, started_at, fallback_error_code)
    return response


def get_runtime_list() -> dict[str, int]:
    return client.index(LEXICAL_APPS_INDEX).search(
        "",
        {
            "filter": [
                "type IN [console-application, desktop-application]",
                "NOT icon IS NULL",
            ],
            "limit": 0,
            "sort": ["installs_last_month:desc"],
            "facets": ["runtime"],
        },
    )["facetDistribution"]["runtime"]


class DevelopersResponse(BaseModel):
    developers: list[str]
    total: int
    page: int
    per_page: int


class KeywordCount(BaseModel):
    keyword: str
    count: int


class KeywordsResponse(BaseModel):
    keywords: list[KeywordCount]
    total: int
    page: int
    per_page: int


def get_developers(page: int | None, hits_per_page: int | None) -> DevelopersResponse:
    result = client.index(LEXICAL_APPS_INDEX).search(
        "",
        {
            "facets": ["developer_name"],
            "limit": 0,
            "hitsPerPage": hits_per_page or 250,
            "page": page or 1,
        },
    )
    facet_distribution = result.get("facetDistribution", {}).get("developer_name", {})

    return DevelopersResponse.model_validate(
        {
            "developers": list(facet_distribution.keys()),
            "total": len(facet_distribution),
            "page": page or 1,
            "per_page": hits_per_page or 250,
        }
    )


def get_keywords(page: int | None, hits_per_page: int | None) -> KeywordsResponse:
    current_page = page or 1
    current_hits_per_page = hits_per_page or 250

    with get_db() as sqldb:
        keyword_counts = sqldb.session.execute(
            text(
                """
                WITH app_keywords AS (
                    SELECT DISTINCT apps.app_id, keyword.value AS keyword
                    FROM apps
                    CROSS JOIN LATERAL jsonb_array_elements_text(
                        COALESCE(appstream -> 'keywords', '[]'::jsonb)
                    ) AS keyword(value)
                    WHERE apps.is_eol = false
                      AND apps.type IN ('desktop-application', 'console-application')
                      AND COALESCE(appstream ->> 'icon', '') <> ''
                )
                SELECT keyword, COUNT(*) AS count
                FROM app_keywords
                GROUP BY keyword
                ORDER BY LOWER(keyword), keyword
                """
            )
        ).mappings()
        all_keywords = list(keyword_counts)

    start = (current_page - 1) * current_hits_per_page
    end = start + current_hits_per_page

    return KeywordsResponse.model_validate(
        {
            "keywords": all_keywords[start:end],
            "total": len(all_keywords),
            "page": current_page,
            "per_page": current_hits_per_page,
        }
    )


def get_number_of_verified_apps() -> int:
    return (
        client.index(LEXICAL_APPS_INDEX)
        .search(
            "",
            {
                "filter": [
                    "verification_verified = true",
                    "type IN [console-application, desktop-application]",
                    "NOT icon IS NULL",
                ],
                "limit": 1,
                "facets": [
                    "verification_verified",
                ],
            },
        )
        .get("facetDistribution", {})
        .get("verification_verified", {})
        .get("true", 0)
    )

import json
import logging
from typing import Any, TypeVar

import meilisearch
from pydantic import BaseModel, field_validator

from app.models import ConnectedAccountProvider

from . import config, schemas
from .verification_method import VerificationMethod

T = TypeVar("T")
logger = logging.getLogger(__name__)

ALLOWED_TRANSLATION_KEYS = {"name", "summary", "description", "keywords"}


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
    keywords: list[str] | None
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


def _configure_meilisearch_index(client):
    client.create_index("apps", {"primaryKey": "id"})
    client.index("apps").update_sortable_attributes(
        [
            "installs_last_month",
            "trending",
            "added_at",
            "updated_at",
            "verification_timestamp",
            "favorites_count",
        ]
    )
    client.index("apps").update_searchable_attributes(
        [
            "name",
            "keywords",
            "summary",
            "description",
            "translations",
            "id",
        ]
    )
    client.index("apps").update_filterable_attributes(
        [
            "main_categories",
            "sub_categories",
            "developer_name",
            "verification_verified",
            "is_free_license",
            "runtime",
            "type",
            "arches",
            "icon",
            "keywords",
            "isMobileFriendly",
        ]
    )


client = meilisearch.Client(
    config.settings.meilisearch_url, config.settings.meilisearch_key
)

_configure_meilisearch_index(client)


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
            if locale in searchResult.translations.keys():
                picked_locale = locale
            elif fallbackLocale in searchResult.translations.keys():
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
) -> tuple[int, list[tuple[dict[str, Any], str]]]:
    if not documents:
        return 0, []

    try:
        index.update_documents(documents)
        return len(documents), []
    except meilisearch.errors.MeilisearchApiError as err:
        if len(documents) == 1:
            return 0, [(documents[0], str(err))]

        midpoint = len(documents) // 2
        accepted_left, skipped_left = _update_documents_with_fallback(
            index, documents[:midpoint]
        )
        accepted_right, skipped_right = _update_documents_with_fallback(
            index, documents[midpoint:]
        )
        return accepted_left + accepted_right, skipped_left + skipped_right


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
            "Meilisearch index update skipped: total=%d indexed=0 skipped=%d",
            len(apps_to_update),
            len(skipped_for_sanitization),
        )
        return

    accepted_count, skipped_for_meili = _update_documents_with_fallback(
        client.index("apps"), sanitized_documents
    )

    for document, reason in skipped_for_meili:
        logger.warning(
            "Skipping Meilisearch document %s due to Meilisearch error: %s",
            _get_doc_identifier(document),
            reason,
        )

    logger.info(
        "Meilisearch index update complete: total=%d indexed=%d skipped=%d",
        len(apps_to_update),
        accepted_count,
        len(skipped_for_sanitization) + len(skipped_for_meili),
    )


def delete_apps(app_id_list: list[str]) -> None:
    if len(app_id_list) > 0:
        return client.index("apps").delete_documents(app_id_list)
    return None


def get_by_selected_categories(
    selected_categories: list[schemas.MainCategory],
    exclude_subcategories: list[str],
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
            client.index("apps").search(
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
    exclude_subcategories: list[str],
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
            client.index("apps").search(
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
            client.index("apps").search(
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
            client.index("apps").search(
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
            client.index("apps").search(
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
            client.index("apps").search(
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
            client.index("apps").search(
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
            client.index("apps").search(
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
            client.index("apps").search(
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
            client.index("apps").search(
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
            client.index("apps").search(
                "",
                {
                    "filter": [
                        f"keywords = '{escaped_keyword}'",
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


def search_apps_post(
    searchquery: SearchQuery, locale: str
) -> MeilisearchResponse[AppsIndex]:
    filters = []

    filteringForType = False
    filteringForDesktopOrConsole = False

    for filter in searchquery.filters or []:
        if filter.filterType == "type":
            filteringForType = True

            if filter.value == "desktop-application":
                filteringForDesktopOrConsole = True
            elif filter.value == "console-application":
                filteringForDesktopOrConsole = True

        filters.append(f"{filter.filterType} = '{filter.value}'")

    if not filteringForType and not filteringForDesktopOrConsole:
        filters.append("type IN [desktop-application, console-application]")

    if not (filteringForType and not filteringForDesktopOrConsole):
        filters.append("NOT icon IS NULL")

    filterString = " AND ".join(filters)

    return _translate_name_and_summary(
        locale,
        MeilisearchResponse[AppsIndex].model_validate(
            client.index("apps").search(
                searchquery.query,
                {
                    "hitsPerPage": searchquery.hits_per_page or 250,
                    "page": searchquery.page or 1,
                    "sort": ["installs_last_month:desc"],
                    "filter": filterString if filterString else None,
                    "facets": [
                        "verification_verified",
                        "main_categories",
                        "is_free_license",
                        "type",
                        "arches",
                    ],
                },
            )
        ),
    )


def get_runtime_list() -> dict[str, int]:
    return client.index("apps").search(
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


def get_developers(page: int | None, hits_per_page: int | None) -> DevelopersResponse:
    result = client.index("apps").search(
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


def get_number_of_verified_apps() -> int:
    return (
        client.index("apps")
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

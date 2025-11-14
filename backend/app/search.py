from typing import TypeVar

import meilisearch
from pydantic import BaseModel, field_validator

from app.models import ConnectedAccountProvider

from . import config, schemas
from .verification_method import VerificationMethod

T = TypeVar("T")


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
    config.settings.meilisearch_url, config.settings.meilisearch_master_key
)

# with how dependent we are on meilisearch, upgrading it without destroying order
# of the applications is hopeless
secondary_client = None
if config.settings.meilisearch_secondary_url:
    secondary_client = meilisearch.Client(
        config.settings.meilisearch_secondary_url,
        config.settings.meilisearch_secondary_master_key,
    )

_configure_meilisearch_index(client)
if secondary_client:
    _configure_meilisearch_index(secondary_client)


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


def create_or_update_apps(apps_to_update: list[dict]):
    client.index("apps").update_documents(apps_to_update)

    if secondary_client:
        secondary_client.index("apps").update_documents(apps_to_update)


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
                        exclude_subcategories_list,
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
                        exclude_subcategories_list,
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

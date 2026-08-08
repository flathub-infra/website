from typing import Any

SEARCHABLE_ATTRIBUTES = [
    "name",
    "keywords",
    "summary",
    "description",
    "translations",
    "id",
]

FILTERABLE_ATTRIBUTES = [
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
    "localized_keywords",
    "isMobileFriendly",
]

SORTABLE_ATTRIBUTES = [
    "installs_last_month",
    "trending",
    "added_at",
    "updated_at",
    "verification_timestamp",
    "favorites_count",
]

RANKING_RULES = [
    "words",
    "typo",
    "proximity",
    "attributeRank",
    "sort",
    "wordPosition",
    "exactness",
]


def configure_index(index: Any) -> list[Any]:
    return [
        index.update_sortable_attributes(SORTABLE_ATTRIBUTES),
        index.update_searchable_attributes(SEARCHABLE_ATTRIBUTES),
        index.update_filterable_attributes(FILTERABLE_ATTRIBUTES),
        index.update_ranking_rules(RANKING_RULES),
    ]

from collections.abc import Mapping
from typing import Any

QUALITY_METADATA_FIELDS: dict[str, tuple[str, ...]] = {
    "branding": ("branding",),
    "app-icon": ("icon",),
    "app-name": ("name",),
    "app-summary": ("summary", "description"),
    "screenshots": ("screenshots",),
}


def changed_quality_metadata_categories(
    previous: Mapping[str, Any] | None, incoming: Mapping[str, Any]
) -> set[str]:
    """Return quality categories whose mapped AppStream fields have changed."""
    if previous is None:
        return set()

    return {
        category
        for category, fields in QUALITY_METADATA_FIELDS.items()
        if any(previous.get(field) != incoming.get(field) for field in fields)
    }


def update_quality_metadata_timestamps(
    previous: Mapping[str, Any] | None,
    incoming: Mapping[str, Any],
    existing_timestamps: Mapping[str, str] | None,
    timestamp: str,
) -> dict[str, str] | None:
    """Update only timestamps for categories affected by changed fields."""
    changed_categories = changed_quality_metadata_categories(previous, incoming)
    if not changed_categories:
        return dict(existing_timestamps) if existing_timestamps else None

    updated_timestamps = dict(existing_timestamps or {})
    for category in changed_categories:
        updated_timestamps[category] = timestamp
    return updated_timestamps

import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.quality_metadata import (
    changed_quality_metadata_categories,
    update_quality_metadata_timestamps,
)


def test_changed_quality_metadata_categories_maps_appstream_fields():
    previous = {
        "name": "Old name",
        "icon": "https://example.com/old.png",
        "summary": "Old summary",
        "screenshots": [{"caption": "Old screenshot"}],
    }
    incoming = {
        "name": "New name",
        "icon": "https://example.com/new.png",
        "summary": "New summary",
        "screenshots": [{"caption": "New screenshot"}],
    }

    assert changed_quality_metadata_categories(previous, incoming) == {
        "app-name",
        "app-icon",
        "app-summary",
        "general",
        "screenshots",
    }


def test_changed_quality_metadata_categories_ignores_identical_and_unmapped_fields():
    previous = {"name": "Same name", "content_rating_details": {"violence": "none"}}
    incoming = {"name": "Same name", "content_rating_details": {"violence": "mild"}}

    assert changed_quality_metadata_categories(previous, incoming) == set()


def test_changed_quality_metadata_categories_ignores_first_ingestion():
    assert changed_quality_metadata_categories(None, {"name": "New app"}) == set()


def test_update_quality_metadata_timestamps_changes_only_affected_categories():
    result = update_quality_metadata_timestamps(
        {"name": "Old name", "summary": "Same summary"},
        {"name": "New name", "summary": "Same summary"},
        {"screenshots": "2026-01-01T00:00:00"},
        "2026-02-01T00:00:00",
    )

    assert result == {
        "app-name": "2026-02-01T00:00:00",
        "general": "2026-02-01T00:00:00",
        "screenshots": "2026-01-01T00:00:00",
    }


def test_update_quality_metadata_timestamps_preserves_map_when_metadata_is_unchanged():
    previous_timestamps = {"app-name": "2026-01-01T00:00:00"}

    result = update_quality_metadata_timestamps(
        {"name": "Same name"},
        {"name": "Same name"},
        previous_timestamps,
        "2026-02-01T00:00:00",
    )

    assert result == previous_timestamps

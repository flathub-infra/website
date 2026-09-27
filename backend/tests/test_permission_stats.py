import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from app import permission_stats


def test_stable_permissions_prefer_x86_64_and_ignore_other_branches():
    permissions = {}
    architectures = {}

    permission_stats.add_stable_permissions(
        permissions,
        architectures,
        app_id="org.example.App",
        branch="beta",
        arch="x86_64",
        metadata={"permissions": {"filesystems": ["host"]}},
    )
    permission_stats.add_stable_permissions(
        permissions,
        architectures,
        app_id="org.example.App",
        branch="stable",
        arch="aarch64",
        metadata={"permissions": {"filesystems": ["home"]}},
    )
    permission_stats.add_stable_permissions(
        permissions,
        architectures,
        app_id="org.example.App",
        branch="stable",
        arch="x86_64",
        metadata={"permissions": {"filesystems": ["host"]}},
    )

    assert permissions == {"org.example.App": {"filesystems": ["host"]}}
    assert architectures == {"org.example.App": "x86_64"}


def test_build_snapshot_counts_distinct_values_and_only_eligible_covered_apps():
    snapshot = permission_stats.build_permission_snapshot(
        {"org.example.App", "org.example.Other", "org.example.Uncovered"},
        {
            "org.example.App": {
                "filesystems": ["host", "host", "host:ro"],
                "session-bus": {"talk": ["org.example.Service", "org.example.Service"]},
                "system-bus": {"own": ["org.example.System"]},
            },
            "org.example.Other": {
                "filesystems": ["host"],
                "session-bus": {"own": ["org.example.Service"]},
            },
            "org.example.NotEligible": {"filesystems": ["host"]},
        },
    )

    assert snapshot == {
        "eligible_apps": 3,
        "apps_with_stable_metadata": 2,
        "permission_counts": {
            "context": {"filesystems": {"host": 2, "host:ro": 1}},
            "session-bus": {
                "talk": {"org.example.Service": 1},
                "own": {"org.example.Service": 1},
            },
            "system-bus": {"own": {"org.example.System": 1}},
        },
    }


def test_date_range_validation_rejects_inverted_ranges():
    with pytest.raises(ValueError, match="start_date must not be after end_date"):
        permission_stats.validate_date_range(
            datetime.date(2026, 9, 30), datetime.date(2026, 9, 1)
        )


def test_recording_same_day_uses_conflict_update():
    session = MagicMock()
    query = session.query.return_value
    query.filter.return_value = query
    query.all.return_value = [("org.example.App",)]
    db = SimpleNamespace(session=session)

    for _ in range(2):
        permission_stats.record_permission_snapshot(
            db,
            {"org.example.App": {"filesystems": ["host"]}},
            snapshot_date=datetime.date(2026, 9, 27),
        )

    assert session.execute.call_count == 2
    sql = str(session.execute.call_args.args[0].compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT (snapshot_date) DO UPDATE" in sql

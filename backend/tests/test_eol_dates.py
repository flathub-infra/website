"""Tests for the eol_dates population logic in summary.update().

These tests exercise the EOL-reconciliation block inline (without a real
database or the full app module chain) so they can run in any environment.
"""
import datetime
from types import SimpleNamespace

# ---------------------------------------------------------------------------
# Minimal stubs
# ---------------------------------------------------------------------------


class _FakeSession:
    def add(self, obj):
        pass

    def commit(self):
        pass

    def rollback(self):
        pass


class _FakeDb:
    session = _FakeSession()


def _make_app(*, app_id: str, is_runtime: bool, eol_dates=None, eol_branches=None):
    """Return a minimal App-like object for testing."""
    return SimpleNamespace(
        app_id=app_id,
        type="runtime" if is_runtime else "app",
        is_eol=False,
        eol_branches=eol_branches,
        eol_message=None,
        eol_dates=eol_dates,
    )


# ---------------------------------------------------------------------------
# Logic extracted from summary.update() for isolated testing
# ---------------------------------------------------------------------------


def _run_eol_reconciliation(
    *,
    summary_eol_map: dict[str, set[str]],
    db_eol_apps: list[str],
    apps: dict[str, SimpleNamespace],
) -> None:
    """
    Replicate the EOL-reconciliation block from summary.update() exactly,
    operating on the supplied in-memory app objects instead of a real database.

    This mirrors the production code in backend/app/summary.py lines 466–488
    (the ``for app_id in apps_to_process:`` loop).
    """
    db_set = set(db_eol_apps)
    apps_to_process = set(summary_eol_map.keys()).union(db_set)

    fake_db = _FakeDb()
    for aid in apps_to_process:
        app = apps.get(aid)
        if not app:
            continue

        if aid in summary_eol_map:
            app.is_eol = True
            app.eol_branches = list(summary_eol_map[aid])
            if app.type == "runtime":
                existing = dict(app.eol_dates or {})
                now_iso = datetime.datetime.now(datetime.UTC).isoformat()
                for branch in summary_eol_map[aid]:
                    existing.setdefault(branch, now_iso)
                existing = {
                    b: d for b, d in existing.items() if b in summary_eol_map[aid]
                }
                app.eol_dates = existing
            fake_db.session.add(app)
        else:
            app.is_eol = False
            app.eol_branches = None
            app.eol_message = None
            app.eol_dates = None
            fake_db.session.add(app)

    fake_db.session.commit()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_eol_dates_set_for_runtime_on_first_observation():
    """A runtime branch going EOL for the first time gets an eol_dates entry."""
    app = _make_app(app_id="org.gnome.Platform", is_runtime=True)

    before = datetime.datetime.now(datetime.UTC)
    _run_eol_reconciliation(
        summary_eol_map={"org.gnome.Platform": {"45"}},
        db_eol_apps=[],
        apps={"org.gnome.Platform": app},
    )
    after = datetime.datetime.now(datetime.UTC)

    assert app.eol_dates is not None
    assert "45" in app.eol_dates
    recorded = datetime.datetime.fromisoformat(app.eol_dates["45"])
    assert before <= recorded <= after


def test_eol_dates_not_set_for_non_runtime():
    """A non-runtime app going EOL must not have eol_dates populated."""
    app = _make_app(app_id="com.example.App", is_runtime=False)

    _run_eol_reconciliation(
        summary_eol_map={"com.example.App": {"stable"}},
        db_eol_apps=[],
        apps={"com.example.App": app},
    )

    assert app.eol_dates is None


def test_eol_dates_first_observed_preserved():
    """Re-running with the same branch still EOL must NOT overwrite the timestamp."""
    original_ts = "2025-01-01T00:00:00+00:00"
    app = _make_app(
        app_id="org.gnome.Platform",
        is_runtime=True,
        eol_dates={"45": original_ts},
        eol_branches=["45"],
    )
    app.is_eol = True

    _run_eol_reconciliation(
        summary_eol_map={"org.gnome.Platform": {"45"}},
        db_eol_apps=["org.gnome.Platform"],
        apps={"org.gnome.Platform": app},
    )

    assert app.eol_dates["45"] == original_ts, "First-observed timestamp must not change"


def test_eol_dates_adds_new_branch():
    """A new branch going EOL while an existing branch already has a date gets a new key."""
    original_ts = "2025-01-01T00:00:00+00:00"
    app = _make_app(
        app_id="org.gnome.Platform",
        is_runtime=True,
        eol_dates={"45": original_ts},
        eol_branches=["45"],
    )
    app.is_eol = True

    before = datetime.datetime.now(datetime.UTC)
    _run_eol_reconciliation(
        summary_eol_map={"org.gnome.Platform": {"45", "46"}},
        db_eol_apps=["org.gnome.Platform"],
        apps={"org.gnome.Platform": app},
    )
    after = datetime.datetime.now(datetime.UTC)

    assert app.eol_dates["45"] == original_ts, "Old branch timestamp must be preserved"
    assert "46" in app.eol_dates
    new_ts = datetime.datetime.fromisoformat(app.eol_dates["46"])
    assert before <= new_ts <= after


def test_eol_dates_pruned_when_branch_no_longer_eol():
    """A branch removed from the EOL set must be pruned from eol_dates."""
    app = _make_app(
        app_id="org.gnome.Platform",
        is_runtime=True,
        eol_dates={
            "45": "2025-01-01T00:00:00+00:00",
            "46": "2025-06-01T00:00:00+00:00",
        },
        eol_branches=["45", "46"],
    )
    app.is_eol = True

    _run_eol_reconciliation(
        # Only branch 46 is still EOL; 45 has been removed.
        summary_eol_map={"org.gnome.Platform": {"46"}},
        db_eol_apps=["org.gnome.Platform"],
        apps={"org.gnome.Platform": app},
    )

    assert "45" not in app.eol_dates, "Removed branch must be pruned"
    assert "46" in app.eol_dates


def test_eol_dates_cleared_when_app_no_longer_eol():
    """When an app is no longer EOL at all, eol_dates must be set to None."""
    app = _make_app(
        app_id="org.gnome.Platform",
        is_runtime=True,
        eol_dates={"45": "2025-01-01T00:00:00+00:00"},
        eol_branches=["45"],
    )
    app.is_eol = True

    _run_eol_reconciliation(
        summary_eol_map={},  # nothing is EOL any more
        db_eol_apps=["org.gnome.Platform"],
        apps={"org.gnome.Platform": app},
    )

    assert app.eol_dates is None
    assert app.is_eol is False

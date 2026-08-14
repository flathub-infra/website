import datetime

from app import stats


def test_add_unknown_version_count():
    versions = {"1.16": 80, "unknown": 5}

    stats._add_unknown_version_count(versions, total=100, reported=85)
    stats._add_unknown_version_count(versions, total=10, reported=12)

    assert versions == {"1.16": 80, "unknown": 20}


def test_recent_version_stats_adds_unknown_os_from_ostree_total(monkeypatch):
    end_date = datetime.date(2026, 8, 12)
    payloads = {
        end_date: {
            "ostree_versions": {"1.16": 100},
            "os_versions": {
                "fedora;42": 40,
                "arch;unknown": 25,
                "unknown": 2,
            },
            "flatpak_versions": {"1.16": 80, "unknown": 5},
        },
        end_date - datetime.timedelta(days=1): {
            "ostree_versions": {"1.16": 10},
            "os_versions": {"fedora;42": 12},
            "flatpak_versions": {"1.16": 12},
        },
        end_date - datetime.timedelta(days=2): {
            "os_versions": {"debian;13": 5},
        },
    }

    monkeypatch.setattr(
        stats.utils,
        "utcnow",
        lambda: datetime.datetime(2026, 8, 14, tzinfo=datetime.UTC),
    )
    monkeypatch.setattr(stats, "_get_stats_for_date", payloads.get)

    os_versions, flatpak_versions, _ = stats._compute_recent_version_stats(days=3)

    assert os_versions == {
        "fedora;42": 52,
        "arch;unknown": 25,
        "debian;13": 5,
        "unknown": 35,
    }
    assert flatpak_versions == {"1.16": 92, "unknown": 20}

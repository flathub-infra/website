import datetime
from collections.abc import Mapping
from typing import Any

from sqlalchemy.dialects.postgresql import insert

from . import models, utils

ELIGIBLE_APP_TYPES = ("desktop-application", "console-application")


def validate_date_range(
    start_date: datetime.date | None, end_date: datetime.date | None
) -> None:
    if start_date is not None and end_date is not None and start_date > end_date:
        raise ValueError("start_date must not be after end_date")


def add_stable_permissions(
    stable_permissions_by_app: dict[str, dict[str, Any]],
    stable_metadata_arch: dict[str, str],
    *,
    app_id: str,
    branch: str,
    arch: str,
    metadata: Mapping[str, Any] | None,
) -> None:
    """Keep stable metadata from the primary architecture, preferring x86_64."""
    if branch != "stable" or metadata is None:
        return
    current_arch = stable_metadata_arch.get(app_id)
    if current_arch is None or (arch == "x86_64" and current_arch != "x86_64"):
        stable_permissions_by_app[app_id] = metadata.get("permissions", {})
        stable_metadata_arch[app_id] = arch


def build_permission_snapshot(
    eligible_app_ids: set[str],
    stable_permissions_by_app: Mapping[str, Mapping[str, Any]],
) -> dict[str, Any]:
    """Count distinct permission values across eligible apps with stable metadata."""
    covered_app_ids = eligible_app_ids.intersection(stable_permissions_by_app)
    counts: dict[str, Any] = {}

    def increment(*path: str) -> None:
        current = counts
        for key in path[:-1]:
            current = current.setdefault(key, {})
        current[path[-1]] = current.get(path[-1], 0) + 1

    for app_id in covered_app_ids:
        permissions = stable_permissions_by_app[app_id]
        for context_key, values in permissions.items():
            if context_key in ("session-bus", "system-bus"):
                if not isinstance(values, Mapping):
                    continue
                for policy, bus_names in values.items():
                    if isinstance(bus_names, str):
                        bus_names = [bus_names]
                    if not isinstance(bus_names, (list, tuple, set)):
                        continue
                    for bus_name in set(bus_names):
                        if isinstance(bus_name, str):
                            increment(context_key, str(policy), bus_name)
                continue

            if isinstance(values, str):
                values = [values]
            if not isinstance(values, (list, tuple, set)):
                continue
            for value in set(values):
                if isinstance(value, str):
                    increment("context", str(context_key), value)

    return {
        "eligible_apps": len(eligible_app_ids),
        "apps_with_stable_metadata": len(covered_app_ids),
        "permission_counts": counts,
    }


def record_permission_snapshot(
    sqldb,
    stable_permissions_by_app: Mapping[str, Mapping[str, Any]],
    snapshot_date: datetime.date | None = None,
) -> dict[str, Any]:
    eligible_app_ids = {
        row[0]
        for row in (
            sqldb.session.query(models.App.app_id)
            .filter(models.App.type.in_(ELIGIBLE_APP_TYPES))
            .filter(models.App.is_eol.is_(False))
            .all()
        )
    }
    snapshot = build_permission_snapshot(eligible_app_ids, stable_permissions_by_app)
    date = snapshot_date or utils.utcnow().date()
    statement = insert(models.PermissionStatsSnapshot).values(
        snapshot_date=date,
        eligible_apps=snapshot["eligible_apps"],
        apps_with_stable_metadata=snapshot["apps_with_stable_metadata"],
        permission_counts=snapshot["permission_counts"],
    )
    statement = statement.on_conflict_do_update(
        index_elements=[models.PermissionStatsSnapshot.snapshot_date],
        set_={
            "eligible_apps": statement.excluded.eligible_apps,
            "apps_with_stable_metadata": statement.excluded.apps_with_stable_metadata,
            "permission_counts": statement.excluded.permission_counts,
        },
    )
    sqldb.session.execute(statement)
    return snapshot

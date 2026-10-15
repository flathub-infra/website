"""Evidence-based maintenance triage. No upstream activity is inferred from age."""

import hashlib
import json
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator

SignalKind = Literal["stale", "runtime", "eol", "unknown"]
FINGERPRINT_PATTERN = r"^(?:v[1-9][0-9]{0,13}:)?[0-9a-f]{64}$"
CURRENT_FINGERPRINT_VERSION = 1


def naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None) if value.tzinfo else value


@dataclass
class Evidence:
    app_id: str
    name: str
    last_updated_at: datetime | None = None
    installs_last_7_days: int = 0
    runtime: str | None = None
    runtime_eol: bool | None = None
    is_eol: bool = False


def _fingerprint_v1(evidence: Evidence) -> str:
    """Frozen schema and serialization, also used by legacy unprefixed hashes."""
    updated = naive_utc(evidence.last_updated_at) if evidence.last_updated_at else None
    return hashlib.sha256(
        json.dumps(
            {
                "updated": updated.isoformat() if updated else None,
                "runtime": evidence.runtime,
                "runtime_eol": evidence.runtime_eol,
                "eol": evidence.is_eol,
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()


# This is a persisted-data contract: add a builder and bump the current version
# when fields or serialization change. Retain old builders so existing snoozes
# still compare their originally reviewed evidence, without a backlog-wide wake.
_FINGERPRINT_BUILDERS: dict[int, Callable[[Evidence], str]] = {1: _fingerprint_v1}


def evidence_fingerprint(evidence: Evidence, version: int | None = None) -> str:
    version = CURRENT_FINGERPRINT_VERSION if version is None else version
    return f"v{version}:{_FINGERPRINT_BUILDERS[version](evidence)}"


def _parse_fingerprint(value: str | None) -> tuple[int, str] | None:
    if value is None or re.fullmatch(FINGERPRINT_PATTERN, value) is None:
        return None
    prefix, separator, digest = value.partition(":")
    return (int(prefix[1:]), digest) if separator else (1, value)


def same_fingerprint(left: str | None, right: str) -> bool:
    parsed = _parse_fingerprint(left)
    return parsed is not None and parsed == _parse_fingerprint(right)


def fingerprint_matches_evidence(evidence: Evidence, saved: str) -> bool:
    parsed = _parse_fingerprint(saved)
    if parsed is None or parsed[0] not in _FINGERPRINT_BUILDERS:
        # Unknown/retired formats cannot prove the evidence is unchanged.
        # Require review rather than silently hiding an unverifiable case.
        return False
    return same_fingerprint(saved, evidence_fingerprint(evidence, parsed[0]))


class MaintenanceSignal(BaseModel):
    kind: SignalKind
    severity: Literal["high", "medium", "low"]
    confidence: Literal["confirmed", "investigate", "unknown"]
    evidence: str
    next_step: str


class MaintenanceCase(BaseModel):
    app_id: str
    name: str
    last_updated_at: datetime | None
    days_since_update: int | None
    installs_last_7_days: int
    runtime: str | None
    runtime_eol: bool | None
    signals: list[MaintenanceSignal]
    fingerprint: str
    owner_id: int | None = None
    owner_name: str | None = None
    owned_by_me: bool = False
    notes: str = ""
    snoozed_until: datetime | None = None
    snooze_reason: str = ""
    snoozed: bool = False
    reopened: bool = False
    version: int = 0


class RuntimeCampaign(BaseModel):
    runtime: str
    apps: int
    installs_last_7_days: int


class MaintenanceDashboard(BaseModel):
    cases: list[MaintenanceCase]
    total: int
    page: int
    page_size: int
    active: int
    snoozed: int
    campaigns: list[RuntimeCampaign]
    evaluated_at: datetime


class MaintenanceAction(BaseModel):
    action: Literal["claim", "release", "snooze", "wake", "notes"]
    version: int = Field(ge=0)
    days: int = Field(default=30, ge=1, le=365)
    reason: str = Field(default="", max_length=2000)
    notes: str = Field(default="", max_length=10000)
    expected_fingerprint: str | None = Field(
        default=None, max_length=80, pattern=FINGERPRINT_PATTERN
    )

    @model_validator(mode="after")
    def require_snooze_fingerprint(self) -> Self:
        if self.action == "snooze" and self.expected_fingerprint is None:
            raise ValueError(
                "A viewed evidence fingerprint is required to snooze a case."
            )
        return self


def assess(evidence: Evidence, now: datetime, stale_days: int = 365) -> MaintenanceCase:
    now = naive_utc(now)
    updated = naive_utc(evidence.last_updated_at) if evidence.last_updated_at else None
    age = max(0, (now - updated).days) if updated else None
    signals = []
    if evidence.runtime_eol is True:
        signals.append(
            MaintenanceSignal(
                kind="runtime",
                severity="high",
                confidence="confirmed",
                evidence=f"The runtime branch {evidence.runtime} is marked end of life.",
                next_step="Check the manifest and plan a supported-runtime migration.",
            )
        )
    if evidence.is_eol and evidence.installs_last_7_days > 0:
        signals.append(
            MaintenanceSignal(
                kind="eol",
                severity="high",
                confidence="confirmed",
                evidence="This app's published branch is end of life and still receives downloads.",
                next_step="Review the retirement message and whether a replacement can be offered.",
            )
        )
    if age is not None and age >= stale_days:
        signals.append(
            MaintenanceSignal(
                kind="stale",
                severity="medium",
                confidence="investigate",
                evidence=f"No recorded package update in {age} days (threshold: {stale_days}).",
                next_step="Compare upstream releases and packaging activity. Age alone is not abandonment.",
            )
        )
    if updated is None:
        signals.append(
            MaintenanceSignal(
                kind="unknown",
                severity="low",
                confidence="unknown",
                evidence="No package-update timestamp is available.",
                next_step="Check repository history before drawing conclusions about maintenance.",
            )
        )
    # Daily age, download counts and the user's threshold must not invalidate a snooze.
    return MaintenanceCase(
        app_id=evidence.app_id,
        name=evidence.name,
        last_updated_at=updated,
        days_since_update=age,
        installs_last_7_days=evidence.installs_last_7_days,
        runtime=evidence.runtime,
        runtime_eol=evidence.runtime_eol,
        signals=signals,
        fingerprint=evidence_fingerprint(evidence),
    )


def apply_triage(
    case: MaintenanceCase,
    triage,
    now: datetime,
    evidence: Evidence,
    owner_name: str | None = None,
) -> None:
    if triage is None:
        return
    case.owner_id = triage.owner_id
    case.owner_name = owner_name
    case.notes = triage.notes
    case.version = triage.version
    case.snoozed_until = triage.snoozed_until
    case.snooze_reason = triage.snooze_reason
    pending_snooze = triage.snoozed_until is not None and naive_utc(
        triage.snoozed_until
    ) > naive_utc(now)
    case.reopened = pending_snooze and not fingerprint_matches_evidence(
        evidence, triage.fingerprint
    )
    case.snoozed = pending_snooze and not case.reopened


def priority(case: MaintenanceCase) -> tuple[int, int, int, str]:
    severity = {"high": 0, "medium": 1, "low": 2}
    return (
        min((severity[s.severity] for s in case.signals), default=3),
        -case.installs_last_7_days,
        -(case.days_since_update or 0),
        case.app_id,
    )


def dashboard(
    cases: list[MaintenanceCase],
    now: datetime,
    *,
    queue: str = "all",
    search: str = "",
    runtime: str | None = None,
    user_id: int,
    page: int = 1,
    page_size: int = 25,
) -> MaintenanceDashboard:
    actionable = [case for case in cases if case.signals]
    active = [case for case in actionable if not case.snoozed]
    groups: dict[str, RuntimeCampaign] = {}
    for case in actionable:
        if case.runtime and case.runtime_eol:
            campaign = groups.setdefault(
                case.runtime,
                RuntimeCampaign(runtime=case.runtime, apps=0, installs_last_7_days=0),
            )
            campaign.apps += 1
            campaign.installs_last_7_days += case.installs_last_7_days
    filtered = []
    needle = search.casefold().strip()
    for case in actionable:
        if queue == "snoozed":
            if not case.snoozed:
                continue
        elif case.snoozed:
            continue
        if queue == "mine" and case.owner_id != user_id:
            continue
        if queue in ("stale", "runtime", "eol", "unknown") and not any(
            s.kind == queue for s in case.signals
        ):
            continue
        if runtime and case.runtime != runtime:
            continue
        if needle and needle not in f"{case.app_id} {case.name}".casefold():
            continue
        filtered.append(case)
    filtered.sort(key=priority)
    campaigns: list[RuntimeCampaign] = sorted(
        groups.values(), key=lambda c: (-c.installs_last_7_days, -c.apps, c.runtime)
    )
    # A snooze or resolved signal can remove the final case on the current page.
    page = min(page, max(1, (len(filtered) + page_size - 1) // page_size))
    return MaintenanceDashboard(
        cases=filtered[(page - 1) * page_size : page * page_size],
        total=len(filtered),
        page=page,
        page_size=page_size,
        active=len(active),
        snoozed=len(actionable) - len(active),
        evaluated_at=now,
        campaigns=campaigns,
    )

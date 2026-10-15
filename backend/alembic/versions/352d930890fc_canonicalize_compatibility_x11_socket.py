import hashlib
import json

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "352d930890fc"
down_revision = "ba6f029c184e"
branch_labels = None
depends_on = None

_MISSING = object()


def _drop_compat_x11(items):
    if "fallback-x11" not in items or any(
        item == "!x11" or item.startswith("if:x11:") for item in items
    ):
        return items
    return [item for item in items if item != "x11"]


def _snapshot(snapshot, version, normalize):
    architectures = {}
    for arch, permissions in snapshot["architectures"].items():
        permissions = dict(permissions)
        context = permissions.get("Context")
        if normalize and context and "sockets" in context:
            permissions["Context"] = {
                **context,
                "sockets": _drop_compat_x11(context["sockets"]),
            }
        architectures[arch] = permissions
    return {"canonicalization_version": version, "architectures": architectures}


def _fingerprint(snapshot):
    return hashlib.sha256(
        json.dumps(
            snapshot, ensure_ascii=True, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
    ).hexdigest()


def _differences(before, after):
    differences = []

    def visit(left, right, path):
        if left is _MISSING or right is _MISSING:
            differences.append(
                {
                    "path": path,
                    "before": None if left is _MISSING else left,
                    "after": None if right is _MISSING else right,
                }
            )
        elif isinstance(left, dict) and isinstance(right, dict):
            for key in sorted(left.keys() | right.keys()):
                visit(left.get(key, _MISSING), right.get(key, _MISSING), [*path, key])
        elif left != right:
            differences.append({"path": path, "before": left, "after": right})

    visit(before["architectures"], after["architectures"], [])
    return differences


def _set_observation_constraint(versions, default):
    op.drop_constraint(
        "permissionassessmentobservation_canonicalization_version",
        "permissionassessmentobservation",
        type_="check",
    )
    op.create_check_constraint(
        "permissionassessmentobservation_canonicalization_version",
        "permissionassessmentobservation",
        f"canonicalization_version IN ({versions})",
    )
    op.alter_column(
        "permissionassessmentobservation",
        "canonicalization_version",
        server_default=sa.text(default),
    )


def _relabel(bind, source, target, normalize):
    baselines = {}
    for row in bind.execute(
        sa.text(
            "SELECT id, snapshot FROM permissionbaseline "
            "WHERE canonicalization_version = :source"
        ),
        {"source": source},
    ).mappings():
        snapshot = _snapshot(row["snapshot"], target, normalize)
        baselines[row["id"]] = _fingerprint(snapshot)
        bind.execute(
            sa.text(
                "UPDATE permissionbaseline SET canonicalization_version = :target, "
                "snapshot = :snapshot, fingerprint = :fingerprint WHERE id = :id"
            ).bindparams(sa.bindparam("snapshot", type_=JSONB)),
            {
                "target": target,
                "snapshot": snapshot,
                "fingerprint": baselines[row["id"]],
                "id": row["id"],
            },
        )

    for row in bind.execute(
        sa.text(
            "SELECT id, outcome, decision_id, baseline_id, candidate_snapshot, "
            "published_snapshot, differences FROM permissionassessmentobservation "
            "WHERE canonicalization_version = :source"
        ),
        {"source": source},
    ).mappings():
        values = {
            "id": row["id"],
            "target": target,
            "candidate": None,
            "fingerprint": None,
            "published": None,
            "published_fingerprint": None,
            "differences": row["differences"],
            "outcome": row["outcome"],
            "basis": None,
        }
        if row["candidate_snapshot"] is not None:
            candidate = _snapshot(row["candidate_snapshot"], target, normalize)
            values.update(candidate=candidate, fingerprint=_fingerprint(candidate))
        if row["published_snapshot"] is not None:
            published = _snapshot(row["published_snapshot"], target, normalize)
            values.update(
                published=published,
                published_fingerprint=_fingerprint(published),
                differences=_differences(published, values["candidate"]),
            )
        if (
            row["outcome"] == "pending"
            and row["decision_id"] is None
            and row["baseline_id"] in baselines
            and values["differences"] == []
            and baselines[row["baseline_id"]] == values["fingerprint"]
        ):
            values.update(outcome="accepted", basis="baseline")
        bind.execute(
            sa.text(
                "UPDATE permissionassessmentobservation SET "
                "canonicalization_version = :target, "
                "candidate_snapshot = :candidate, fingerprint = :fingerprint, "
                "published_snapshot = :published, "
                "published_fingerprint = :published_fingerprint, "
                "differences = :differences, outcome = :outcome, "
                "acceptance_basis = COALESCE(:basis, acceptance_basis) "
                "WHERE id = :id"
            ).bindparams(
                sa.bindparam("candidate", type_=JSONB(none_as_null=True)),
                sa.bindparam("published", type_=JSONB(none_as_null=True)),
                sa.bindparam("differences", type_=JSONB(none_as_null=True)),
                sa.bindparam("basis", type_=sa.String),
            ),
            values,
        )


def upgrade():
    _set_observation_constraint("2, 3, 4", "4")
    _relabel(op.get_bind(), 3, 4, normalize=True)


def downgrade():
    _relabel(op.get_bind(), 4, 3, normalize=False)
    _set_observation_constraint("2, 3", "3")

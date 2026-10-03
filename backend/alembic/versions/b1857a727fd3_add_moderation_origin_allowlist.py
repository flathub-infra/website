import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "b1857a727fd3"
down_revision = "145992160c2c"
branch_labels = None
depends_on = None


def _approved_request_origins(request_type, request_data):
    try:
        data = json.loads(request_data or "")
    except (TypeError, json.JSONDecodeError):
        return set()
    if not isinstance(data, dict):
        return set()

    origins = set()
    if request_type == "manifest":
        findings = data.get("findings")
        for finding in findings if isinstance(findings, list) else []:
            added = finding.get("origins_added") if isinstance(finding, dict) else None
            for origin in added if isinstance(added, list) else []:
                if isinstance(origin, str) and origin:
                    origins.add(("manifest-source", origin))
    elif request_type == "summary":
        keys = data.get("keys")
        current_values = data.get("current_values")
        build_origins = keys.get("extra-data") if isinstance(keys, dict) else None
        current_origins = (
            current_values.get("extra-data")
            if isinstance(current_values, dict)
            else None
        )
        if isinstance(build_origins, list):
            known = set(current_origins) if isinstance(current_origins, list) else set()
            for origin in build_origins:
                if (
                    isinstance(origin, str)
                    and origin
                    and not origin.startswith("<")
                    and origin not in known
                ):
                    origins.add(("extra-data", origin))
    return origins


def upgrade():
    allowlist = op.create_table(
        "moderationoriginallowlist",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("origin", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        sa.Column("request_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["approved_by"], ["flathubuser.id"]),
        sa.ForeignKeyConstraint(
            ["request_id"], ["moderationrequest.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "moderationoriginallowlist_kind_origin",
        "moderationoriginallowlist",
        ["kind", "origin"],
        unique=True,
    )

    rows = op.get_bind().execute(
        sa.text(
            "SELECT id, request_type, request_data, handled_by, "
            "COALESCE(handled_at, created_at) AS handled_at "
            "FROM moderationrequest "
            "WHERE is_approved IS TRUE "
            "AND is_observation IS FALSE "
            "AND request_type IN ('manifest', 'summary') "
            "ORDER BY COALESCE(handled_at, created_at), id"
        )
    )
    entries = {}
    for row in rows:
        for kind, origin in _approved_request_origins(
            row.request_type, row.request_data
        ):
            entries.setdefault(
                (kind, origin),
                {
                    "kind": kind,
                    "origin": origin,
                    "created_at": row.handled_at,
                    "approved_by": row.handled_by,
                    "request_id": row.id,
                },
            )
    values = list(entries.values())
    for start in range(0, len(values), 1000):
        op.get_bind().execute(
            postgresql.insert(allowlist)
            .values(values[start : start + 1000])
            .on_conflict_do_nothing(index_elements=["kind", "origin"])
        )


def downgrade():
    op.drop_index(
        "moderationoriginallowlist_kind_origin",
        table_name="moderationoriginallowlist",
    )
    op.drop_table("moderationoriginallowlist")

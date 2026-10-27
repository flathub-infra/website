from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "28a6ec6f07d9"
down_revision = "c4238c3119f2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "permissionrule",
        sa.Column("removed", postgresql.JSONB(none_as_null=True), nullable=True),
    )
    op.add_column(
        "permissionrule",
        sa.Column("added", postgresql.JSONB(none_as_null=True), nullable=True),
    )
    op.execute(
        """
        CREATE FUNCTION permissionrule_valid_delta(removed jsonb, added jsonb)
        RETURNS boolean
        LANGUAGE sql IMMUTABLE
        AS $$
            SELECT CASE
                WHEN removed IS NULL OR added IS NULL
                    OR jsonb_typeof(removed) <> 'array'
                    OR jsonb_typeof(added) <> 'array'
                THEN false
                ELSE jsonb_array_length(removed) + jsonb_array_length(added) > 0
                    AND NOT EXISTS (
                        SELECT 1 FROM jsonb_array_elements(removed || added) AS entries(value)
                        WHERE jsonb_typeof(value) <> 'string'
                            OR (value #>> '{}') !~ '[^[:space:]]'
                    )
                    AND (
                        SELECT count(*) = count(DISTINCT value)
                        FROM jsonb_array_elements(removed || added) AS entries(value)
                    )
            END
        $$
        """
    )
    op.drop_constraint("permissionrule_match_type", "permissionrule", type_="check")
    op.create_check_constraint(
        "permissionrule_match_type",
        "permissionrule",
        "(match_type = 'destination' AND before IS NULL AND value IS NOT NULL "
        "AND removed IS NULL AND added IS NULL) "
        "OR (match_type = 'transition' AND num_nonnulls(before, value) > 0 "
        "AND before IS DISTINCT FROM value AND removed IS NULL AND added IS NULL) "
        "OR (match_type = 'grouped-delta' AND before IS NULL AND value IS NULL "
        "AND permissionrule_valid_delta(removed, added) "
        "AND (permission_group = 'USB Devices' OR (permission_group = 'Context' "
        "AND key IN ('shared', 'sockets', 'devices', 'features', 'filesystems', 'persistent'))))",
    )
    for name, endpoints, predicate in (
        ("addition", ["value"], '"before" IS NULL'),
        ("removal", ["before"], "value IS NULL"),
    ):
        op.drop_index(f"permissionrule_{name}_unique", table_name="permissionrule")
        op.create_index(
            f"permissionrule_{name}_unique",
            "permissionrule",
            ["match_type", "permission_group", "key", *endpoints],
            unique=True,
            postgresql_where=sa.text(f"match_type <> 'grouped-delta' AND {predicate}"),
        )
    op.create_index(
        "permissionrule_grouped_delta_unique",
        "permissionrule",
        ["permission_group", "key", "removed", "added"],
        unique=True,
        postgresql_where=sa.text("match_type = 'grouped-delta'"),
    )


def downgrade():
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM permissionrule WHERE match_type = 'grouped-delta'
            ) OR EXISTS (
                SELECT 1 FROM permissiondecision,
                    LATERAL jsonb_array_elements(rules) AS entries(rule)
                WHERE rule->>'match_type' = 'grouped-delta'
            ) THEN
                RAISE EXCEPTION 'Cannot downgrade grouped permission rules or history';
            END IF;
        END $$;
        """
    )
    op.drop_index("permissionrule_grouped_delta_unique", table_name="permissionrule")
    for name, endpoints, predicate in (
        ("addition", ["value"], '"before" IS NULL'),
        ("removal", ["before"], "value IS NULL"),
    ):
        op.drop_index(f"permissionrule_{name}_unique", table_name="permissionrule")
        op.create_index(
            f"permissionrule_{name}_unique",
            "permissionrule",
            ["match_type", "permission_group", "key", *endpoints],
            unique=True,
            postgresql_where=sa.text(predicate),
        )
    op.drop_constraint("permissionrule_match_type", "permissionrule", type_="check")
    op.create_check_constraint(
        "permissionrule_match_type",
        "permissionrule",
        "(match_type = 'destination' AND before IS NULL AND value IS NOT NULL) "
        "OR (match_type = 'transition' AND num_nonnulls(before, value) > 0 "
        "AND before IS DISTINCT FROM value)",
    )
    op.drop_column("permissionrule", "removed")
    op.drop_column("permissionrule", "added")
    op.execute("DROP FUNCTION permissionrule_valid_delta(jsonb, jsonb)")

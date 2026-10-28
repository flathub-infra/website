from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "f276d42efaa0"
down_revision = "28a6ec6f07d9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "permissionrule",
        sa.Column("required", postgresql.JSONB(), nullable=False, server_default="[]"),
    )
    op.execute(
        """
        CREATE FUNCTION permissionrule_valid_required(required jsonb, removed jsonb, added jsonb)
        RETURNS boolean
        LANGUAGE sql IMMUTABLE
        AS $$
            SELECT CASE
                WHEN required IS NULL OR jsonb_typeof(required) <> 'array' THEN false
                ELSE NOT EXISTS (
                    SELECT 1 FROM jsonb_array_elements(required) AS entries(value)
                    WHERE jsonb_typeof(value) <> 'string'
                        OR (value #>> '{}') !~ '[^[:space:]]'
                )
                AND (
                    SELECT count(*) = count(DISTINCT value)
                    FROM jsonb_array_elements(required) AS entries(value)
                )
                AND NOT EXISTS (
                    SELECT 1 FROM jsonb_array_elements(required) AS entries(value)
                    WHERE coalesce(removed, '[]'::jsonb) @> jsonb_build_array(value)
                        OR coalesce(added, '[]'::jsonb) @> jsonb_build_array(value)
                )
            END
        $$
        """
    )
    op.create_check_constraint(
        "permissionrule_required",
        "permissionrule",
        "permissionrule_valid_required(required, removed, added) "
        "AND (match_type = 'grouped-delta' OR required = '[]'::jsonb)",
    )
    op.drop_index("permissionrule_grouped_delta_unique", table_name="permissionrule")
    op.create_index(
        "permissionrule_grouped_delta_unique",
        "permissionrule",
        ["permission_group", "key", "removed", "added", "required"],
        unique=True,
        postgresql_where=sa.text("match_type = 'grouped-delta'"),
    )


def downgrade():
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM permissionrule WHERE required <> '[]'::jsonb)
                OR EXISTS (
                    SELECT 1 FROM permissiondecision,
                        LATERAL jsonb_array_elements(rules) AS entries(rule)
                    WHERE coalesce(rule->'required', '[]'::jsonb) <> '[]'::jsonb
                ) THEN
                RAISE EXCEPTION 'Cannot downgrade required permission rules or history';
            END IF;
        END $$;
        """
    )
    op.drop_index("permissionrule_grouped_delta_unique", table_name="permissionrule")
    op.create_index(
        "permissionrule_grouped_delta_unique",
        "permissionrule",
        ["permission_group", "key", "removed", "added"],
        unique=True,
        postgresql_where=sa.text("match_type = 'grouped-delta'"),
    )
    op.drop_constraint("permissionrule_required", "permissionrule", type_="check")
    op.drop_column("permissionrule", "required")
    op.execute("DROP FUNCTION permissionrule_valid_required(jsonb, jsonb, jsonb)")

"""add permission rule transitions

Revision ID: c4238c3119f2
Revises: 49cc2e861a9e, 5a6cba1a7f2f
Create Date: 2026-10-27 09:19:58.967966

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c4238c3119f2"
down_revision = ("49cc2e861a9e", "5a6cba1a7f2f")
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "permissionrule",
        sa.Column(
            "match_type", sa.String(), server_default="destination", nullable=False
        ),
    )
    op.add_column("permissionrule", sa.Column("before", sa.String(), nullable=True))
    op.alter_column("permissionrule", "value", nullable=True)
    op.drop_index("permissionrule_permission_unique", table_name="permissionrule")
    op.drop_constraint("permissionrule_nonempty", "permissionrule", type_="check")
    op.drop_constraint("permissionrule_bus_policy", "permissionrule", type_="check")
    op.create_check_constraint(
        "permissionrule_nonempty",
        "permissionrule",
        "btrim(key) <> '' AND btrim(rationale) <> '' "
        "AND (before IS NULL OR btrim(before) <> '') "
        "AND (value IS NULL OR btrim(value) <> '')",
    )
    op.create_check_constraint(
        "permissionrule_match_type",
        "permissionrule",
        "(match_type = 'destination' AND before IS NULL AND value IS NOT NULL) "
        "OR (match_type = 'transition' AND num_nonnulls(before, value) > 0 "
        "AND before IS DISTINCT FROM value)",
    )
    op.create_check_constraint(
        "permissionrule_bus_policy",
        "permissionrule",
        "permission_group NOT IN ('Session Bus Policy', 'System Bus Policy') "
        "OR ((before IS NULL OR before IN ('none', 'see', 'talk', 'own')) "
        "AND (value IS NULL OR value IN ('none', 'see', 'talk', 'own')))",
    )
    for name, endpoints, predicate in (
        ("addition", ["value"], '"before" IS NULL'),
        ("removal", ["before"], "value IS NULL"),
        (
            "replacement",
            ["before", "value"],
            '"before" IS NOT NULL AND value IS NOT NULL',
        ),
    ):
        op.create_index(
            f"permissionrule_{name}_unique",
            "permissionrule",
            ["match_type", "permission_group", "key", *endpoints],
            unique=True,
            postgresql_where=sa.text(predicate),
        )
    op.execute(
        """
        UPDATE permissiondecision
        SET rules = (
            SELECT jsonb_agg(
                rule || '{"match_type": "destination", "before": null}'::jsonb
                ORDER BY ordinal
            )
            FROM jsonb_array_elements(rules) WITH ORDINALITY AS entries(rule, ordinal)
        )
        WHERE rules IS NOT NULL AND jsonb_array_length(rules) > 0
        """
    )


def downgrade():
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM permissionrule
                WHERE match_type = 'transition'
                   OR (permission_group IN ('Session Bus Policy', 'System Bus Policy')
                       AND value = 'none')
            ) OR EXISTS (
                SELECT 1 FROM permissiondecision,
                    LATERAL jsonb_array_elements(rules) AS entries(rule)
                WHERE rule->>'match_type' = 'transition'
            ) THEN
                RAISE EXCEPTION 'Cannot downgrade permission transition rules or history';
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        UPDATE permissiondecision
        SET rules = (
            SELECT jsonb_agg(rule - 'match_type' - 'before' ORDER BY ordinal)
            FROM jsonb_array_elements(rules) WITH ORDINALITY AS entries(rule, ordinal)
        )
        WHERE rules IS NOT NULL AND jsonb_array_length(rules) > 0
        """
    )
    for name in ("addition", "removal", "replacement"):
        op.drop_index(f"permissionrule_{name}_unique", table_name="permissionrule")
    for name in ("match_type", "nonempty", "bus_policy"):
        op.drop_constraint(f"permissionrule_{name}", "permissionrule", type_="check")
    op.alter_column("permissionrule", "value", nullable=False)
    op.drop_column("permissionrule", "before")
    op.drop_column("permissionrule", "match_type")
    op.create_check_constraint(
        "permissionrule_nonempty",
        "permissionrule",
        "btrim(key) <> '' AND btrim(value) <> '' AND btrim(rationale) <> ''",
    )
    op.create_check_constraint(
        "permissionrule_bus_policy",
        "permissionrule",
        "permission_group NOT IN ('Session Bus Policy', 'System Bus Policy') "
        "OR value IN ('see', 'talk', 'own')",
    )
    op.create_index(
        "permissionrule_permission_unique",
        "permissionrule",
        ["permission_group", "key", "value"],
        unique=True,
    )

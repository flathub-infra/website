"""add permission rules

Revision ID: 5a6cba1a7f2f
Revises: ce2fee2e8d91
Create Date: 2026-10-24 19:08:07.040765

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '5a6cba1a7f2f'
down_revision = 'ce2fee2e8d91'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "permissionrule",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("updated_by", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("decision", sa.String(), nullable=False),
        sa.Column("permission_group", sa.String(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("rationale", sa.String(), nullable=False),
        sa.CheckConstraint(
            "decision IN ('approved', 'rejected')", name="permissionrule_decision"
        ),
        sa.CheckConstraint(
            "permission_group IN "
            "('Context', 'Session Bus Policy', 'System Bus Policy', 'USB Devices')",
            name="permissionrule_group",
        ),
        sa.CheckConstraint(
            "btrim(key) <> '' AND btrim(value) <> '' AND btrim(rationale) <> ''",
            name="permissionrule_nonempty",
        ),
        sa.CheckConstraint(
            "permission_group NOT IN ('Session Bus Policy', 'System Bus Policy') "
            "OR value IN ('see', 'talk', 'own')",
            name="permissionrule_bus_policy",
        ),
        sa.ForeignKeyConstraint(["created_by"], ["flathubuser.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["flathubuser.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "permissionrule_permission_unique",
        "permissionrule",
        ["permission_group", "key", "value"],
        unique=True,
    )
    op.alter_column("permissiondecision", "reviewer_id", nullable=True)
    op.add_column(
        "permissiondecision",
        sa.Column("rules", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_check_constraint(
        "permissiondecision_decider",
        "permissiondecision",
        "num_nonnulls(reviewer_id, rules) = 1",
    )
    op.create_check_constraint(
        "permissiondecision_rule_decision",
        "permissiondecision",
        "rules IS NULL OR decision IN ('approved', 'rejected')",
    )


def downgrade():
    op.drop_constraint(
        "permissiondecision_rule_decision", "permissiondecision", type_="check"
    )
    op.drop_constraint("permissiondecision_decider", "permissiondecision", type_="check")
    op.drop_column("permissiondecision", "rules")
    op.alter_column("permissiondecision", "reviewer_id", nullable=False)
    op.drop_index("permissionrule_permission_unique", table_name="permissionrule")
    op.drop_table("permissionrule")

"""Curated app selections

Revision ID: 6b1f4e2d9c8a
Revises: d327db764c77
Create Date: 2026-07-05 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "6b1f4e2d9c8a"
down_revision = "d327db764c77"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.create_table(
        "selectiontheme",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_selectiontheme_key"), "selectiontheme", ["key"], unique=True)
    op.bulk_insert(
        sa.table(
            "selectiontheme",
            sa.column("key", sa.String()),
            sa.column("name", sa.String()),
            sa.column("enabled", sa.Boolean()),
        ),
        [
            {
                "key": "new-year-new-workflows",
                "name": "New Year, New Workflows",
                "enabled": True,
            },
            {
                "key": "free-software-favorites",
                "name": "Free Software Favorites",
                "enabled": True,
            },
            {
                "key": "spring-creativity",
                "name": "Spring Creativity",
                "enabled": True,
            },
            {
                "key": "fresh-desktop-releases",
                "name": "Fresh Desktop Releases",
                "enabled": True,
            },
            {
                "key": "staying-connected",
                "name": "Staying Connected",
                "enabled": True,
            },
            {
                "key": "summer-travel",
                "name": "Summer Travel",
                "enabled": True,
            },
            {
                "key": "back-to-learning",
                "name": "Back to Learning",
                "enabled": True,
            },
            {
                "key": "winter-comforts",
                "name": "Winter Comforts",
                "enabled": True,
            },
            {
                "key": "tools-for-developers",
                "name": "Tools for Developers",
                "enabled": True,
            },
            {
                "key": "take-better-notes",
                "name": "Take Better Notes",
                "enabled": True,
            },
            {
                "key": "get-focused",
                "name": "Get Focused",
                "enabled": True,
            },
            {
                "key": "make-some-noise",
                "name": "Make Some Noise",
                "enabled": True,
            },
            {
                "key": "get-to-work",
                "name": "Get To Work",
                "enabled": True,
            },
        ],
    )

    op.create_table(
        "scheduledselection",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("theme_id", sa.Integer(), nullable=False),
        sa.Column("slot", sa.String(), nullable=False),
        sa.Column("starts_at", sa.Date(), nullable=False),
        sa.Column("ends_at", sa.Date(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("starts_at <= ends_at", name="scheduledselection_date_range"),
        sa.CheckConstraint(
            "slot IN ('after-hero', 'after-top-apps', 'after-first-category-block')",
            name="scheduledselection_slot",
        ),
        sa.ForeignKeyConstraint(["theme_id"], ["selectiontheme.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scheduledselection_ends_at"), "scheduledselection", ["ends_at"], unique=False)
    op.create_index(op.f("ix_scheduledselection_slot"), "scheduledselection", ["slot"], unique=False)
    op.create_index(op.f("ix_scheduledselection_starts_at"), "scheduledselection", ["starts_at"], unique=False)
    op.create_index(op.f("ix_scheduledselection_theme_id"), "scheduledselection", ["theme_id"], unique=False)
    op.execute(
        "ALTER TABLE scheduledselection "
        "ADD CONSTRAINT scheduledselection_enabled_slot_date_overlap "
        "EXCLUDE USING gist "
        "(slot WITH =, daterange(starts_at, ends_at, '[]') WITH &&) "
        "WHERE (enabled)"
    )

    op.create_table(
        "scheduledselectionapp",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scheduled_selection_id", sa.Integer(), nullable=False),
        sa.Column("app_id", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["app_id"], ["apps.app_id"]),
        sa.ForeignKeyConstraint(
            ["scheduled_selection_id"], ["scheduledselection.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scheduledselectionapp_app_id"), "scheduledselectionapp", ["app_id"], unique=False)
    op.create_index(
        op.f("ix_scheduledselectionapp_scheduled_selection_id"),
        "scheduledselectionapp",
        ["scheduled_selection_id"],
        unique=False,
    )
    op.create_index(
        "scheduledselectionapp_selection_app_unique",
        "scheduledselectionapp",
        ["scheduled_selection_id", "app_id"],
        unique=True,
    )
    op.create_index(
        "scheduledselectionapp_selection_position_unique",
        "scheduledselectionapp",
        ["scheduled_selection_id", "position"],
        unique=True,
    )


def downgrade():
    op.drop_index(
        "scheduledselectionapp_selection_position_unique",
        table_name="scheduledselectionapp",
    )
    op.drop_index(
        "scheduledselectionapp_selection_app_unique",
        table_name="scheduledselectionapp",
    )
    op.drop_index(
        op.f("ix_scheduledselectionapp_scheduled_selection_id"),
        table_name="scheduledselectionapp",
    )
    op.drop_index(op.f("ix_scheduledselectionapp_app_id"), table_name="scheduledselectionapp")
    op.drop_table("scheduledselectionapp")

    op.drop_index(op.f("ix_scheduledselection_theme_id"), table_name="scheduledselection")
    op.execute(
        "ALTER TABLE scheduledselection "
        "DROP CONSTRAINT scheduledselection_enabled_slot_date_overlap"
    )
    op.drop_index(op.f("ix_scheduledselection_starts_at"), table_name="scheduledselection")
    op.drop_index(op.f("ix_scheduledselection_slot"), table_name="scheduledselection")
    op.drop_index(op.f("ix_scheduledselection_ends_at"), table_name="scheduledselection")
    op.drop_table("scheduledselection")

    op.execute(
        "DELETE FROM selectiontheme WHERE key IN ("
        "'new-year-new-workflows',"
        "'free-software-favorites',"
        "'spring-creativity',"
        "'fresh-desktop-releases',"
        "'staying-connected',"
        "'summer-travel',"
        "'back-to-learning',"
        "'winter-comforts',"
        "'tools-for-developers',"
        "'take-better-notes',"
        "'get-focused',"
        "'make-some-noise',"
        "'get-to-work'"
        ")"
    )
    op.drop_index(op.f("ix_selectiontheme_key"), table_name="selectiontheme")
    op.drop_table("selectiontheme")

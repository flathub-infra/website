"""Replace carousel selection layout with featured screenshots.

Revision ID: 9e2f6c8a104b
Revises: 9d2c7af641b3
"""

from alembic import op

revision = "9e2f6c8a104b"
down_revision = "9d2c7af641b3"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("scheduledselection_layout", "scheduledselection", type_="check")
    # Keep larger selections as grids so no curated apps are silently hidden.
    op.execute("""
        UPDATE scheduledselection SET layout = CASE
            WHEN (SELECT count(*) FROM scheduledselectionapp
                  WHERE scheduled_selection_id = scheduledselection.id) > 3 THEN 'grid'
            ELSE 'featured' END
        WHERE layout = 'carousel'
    """)
    op.create_check_constraint(
        "scheduledselection_layout",
        "scheduledselection",
        "layout IN ('grid', 'featured')",
    )


def downgrade():
    op.drop_constraint("scheduledselection_layout", "scheduledselection", type_="check")
    op.execute(
        "UPDATE scheduledselection SET layout = 'carousel' WHERE layout = 'featured'"
    )
    op.create_check_constraint(
        "scheduledselection_layout",
        "scheduledselection",
        "layout IN ('grid', 'carousel')",
    )

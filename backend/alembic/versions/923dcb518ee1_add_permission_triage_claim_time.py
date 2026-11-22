"""Add permission triage claim time.

Drain and stop old permission-triage consumers before upgrading. Start the
new workers after the migration commits. Old workers do not honor claim times.
"""

import sqlalchemy as sa

from alembic import op

revision = "923dcb518ee1"
down_revision = "7bbc44db5503"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("permissiontriage", sa.Column("claimable_at", sa.DateTime()))
    # Old pending attempts have no recorded deadline. Allow their maximum
    # retry delay to elapse before a new worker can claim them.
    op.execute("""
        UPDATE permissiontriage
        SET claimable_at = (statement_timestamp() AT TIME ZONE 'UTC') + interval '1 hour'
        WHERE status = 'pending' AND attempts > 0
    """)


def downgrade():
    op.drop_column("permissiontriage", "claimable_at")

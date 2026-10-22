"""add moderation discussion opener

Revision ID: 9b53f4fbc132
Revises: 4c8e1f9a2b73
Create Date: 2026-10-21 21:01:13.652349

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9b53f4fbc132'
down_revision = '4c8e1f9a2b73'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "moderationrequest",
        sa.Column(
            "discussion_opened_by",
            sa.Integer(),
            sa.ForeignKey("flathubuser.id"),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE moderationrequest
        SET discussion_opened_by = auditlog.user_id
        FROM auditlog
        WHERE auditlog.event_type = 'moderation-discussion-opened'
          AND auditlog.details->>'discussion_url' = moderationrequest.discussion_url
        """
    )


def downgrade():
    op.drop_column("moderationrequest", "discussion_opened_by")

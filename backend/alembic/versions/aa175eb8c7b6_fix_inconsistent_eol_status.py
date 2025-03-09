"""Fix inconsistent EOL status

Revision ID: aa175eb8c7b6
Revises: 831aa033265e
Create Date: 2025-03-09 06:40:09.895112

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'aa175eb8c7b6'
down_revision = '831aa033265e'
branch_labels = None
depends_on = None


def upgrade():
    # Fix apps where all branches are EOL but is_eol flag is not set
    op.execute("""
    UPDATE apps
    SET is_eol = true
    WHERE 
        is_eol = false AND
        eol_branches IS NOT NULL AND
        jsonb_array_length(eol_branches) > 0 AND
        app_id IN (
            SELECT app_id FROM apps
            WHERE type = 'desktop-application' AND
                (SELECT COUNT(DISTINCT ref) FROM refs WHERE app_id = apps.app_id) = 1 AND
                (SELECT COUNT(DISTINCT ref) FROM refs WHERE app_id = apps.app_id AND ref = ANY(apps.eol_branches::text[])) = 1
        )
    """)


def downgrade():
    # No downgrade needed - we can't reliably know which records were modified
    pass

"""Grant app management to the admin role."""

from alembic import op

revision = "6d5b320ac749"
down_revision = "acffd9118806"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("INSERT INTO permission (name) VALUES ('manage-apps')")
    op.execute(
        "INSERT INTO role_permission (role_id, permission_name) "
        "SELECT id, 'manage-apps' FROM role WHERE name = 'admin'"
    )


def downgrade():
    op.execute("DELETE FROM role_permission WHERE permission_name = 'manage-apps'")
    op.execute("DELETE FROM permission WHERE name = 'manage-apps'")

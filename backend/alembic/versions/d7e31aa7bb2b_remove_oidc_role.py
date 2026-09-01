from alembic import op
import sqlalchemy as sa


revision = 'd7e31aa7bb2b'
down_revision = 'b7c6d5e4f3a2'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        sa.text(
            "DELETE FROM role_permission WHERE role_id = "
            "(SELECT id FROM role WHERE name = 'oidc')"
        )
    )
    op.execute(
        sa.text(
            "DELETE FROM flathubuser_role WHERE role_id = "
            "(SELECT id FROM role WHERE name = 'oidc')"
        )
    )
    op.execute(sa.text("DELETE FROM role WHERE name = 'oidc'"))


def downgrade():
    op.bulk_insert(
        sa.table(
            "role",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(), nullable=False, unique=True),
        ),
        [
            {"id": 5, "name": "oidc"},
        ],
    )

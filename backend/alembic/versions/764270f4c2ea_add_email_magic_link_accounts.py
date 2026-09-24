import sqlalchemy as sa

from alembic import op

revision = '764270f4c2ea'
down_revision = 'd7e31aa7bb2b'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "emailaccount",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user", sa.Integer(), sa.ForeignKey("flathubuser.id"), nullable=False, unique=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("verified_at", sa.DateTime(), nullable=False),
        sa.Column("last_used", sa.DateTime()),
        sa.Column("disabled_at", sa.DateTime()),
    )
    op.create_table(
        "emailloginchallenge",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("flathubuser.id")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("consumed_at", sa.DateTime()),
        sa.Column("locale", sa.String(), nullable=False),
        sa.Column("return_to", sa.String(), nullable=False),
    )
    op.create_index("ix_emailloginchallenge_expires_at", "emailloginchallenge", ["expires_at"])


def downgrade():
    op.drop_index("ix_emailloginchallenge_expires_at", table_name="emailloginchallenge")
    op.drop_table("emailloginchallenge")
    op.drop_table("emailaccount")

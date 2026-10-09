"""add passkey credentials

Revision ID: e0573a1c1bcd
Revises: 6c6c72c6fd92
Create Date: 2026-10-09 10:09:14.305298

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "e0573a1c1bcd"
down_revision = "6c6c72c6fd92"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "flathubuser",
        sa.Column("webauthn_user_handle", sa.LargeBinary(length=64), nullable=True),
    )
    op.create_unique_constraint(
        "flathubuser_webauthn_user_handle_key",
        "flathubuser",
        ["webauthn_user_handle"],
    )
    op.create_table(
        "passkeycredential",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user", sa.Integer(), nullable=False),
        sa.Column("credential_id", sa.LargeBinary(), nullable=False),
        sa.Column("public_key", sa.LargeBinary(), nullable=False),
        sa.Column("sign_count", sa.BigInteger(), nullable=False),
        sa.Column(
            "transports", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user"], ["flathubuser.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("credential_id"),
    )
    op.create_index(op.f("ix_passkeycredential_user"), "passkeycredential", ["user"])


def downgrade():
    op.drop_index(op.f("ix_passkeycredential_user"), table_name="passkeycredential")
    op.drop_table("passkeycredential")
    op.drop_constraint(
        "flathubuser_webauthn_user_handle_key", "flathubuser", type_="unique"
    )
    op.drop_column("flathubuser", "webauthn_user_handle")

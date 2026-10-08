import sqlalchemy as sa
from alembic import op

revision = "8d9b00c70619"
down_revision = "123b6483fbe5"
branch_labels = None
depends_on = None

_CASE_INSENSITIVE_FORGE_ORIGIN = (
    r"^[a-z][a-z0-9+.-]*://"
    r"(github\.com|raw\.githubusercontent\.com|codeberg\.org"
    r"|gitlab\.com|gitlab\.gnome\.org|invent\.kde\.org)(:[0-9]+)?/"
)


def upgrade():
    bind = op.get_bind()
    params = {"pattern": _CASE_INSENSITIVE_FORGE_ORIGIN}
    bind.execute(
        sa.text(
            "DELETE FROM moderationoriginallowlist AS mixed "
            "USING moderationoriginallowlist AS kept "
            "WHERE mixed.kind = 'manifest-source' "
            "AND mixed.origin ~ :pattern "
            "AND mixed.origin <> lower(mixed.origin) "
            "AND kept.kind = mixed.kind "
            "AND kept.id <> mixed.id "
            "AND lower(kept.origin) = lower(mixed.origin) "
            "AND (kept.origin = lower(kept.origin) OR kept.id < mixed.id)"
        ),
        params,
    )
    bind.execute(
        sa.text(
            "UPDATE moderationoriginallowlist "
            "SET origin = lower(origin) "
            "WHERE kind = 'manifest-source' "
            "AND origin ~ :pattern "
            "AND origin <> lower(origin)"
        ),
        params,
    )


def downgrade():
    pass

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'e6c796a1bdf3'
down_revision = 'f276d42efaa0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "stats_daily",
        sa.Column("date", sa.Date(), primary_key=True),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "stats_daily_ref",
        sa.Column("date", sa.Date(), sa.ForeignKey("stats_daily.date", ondelete="CASCADE"), primary_key=True),
        sa.Column("ref", sa.String(), primary_key=True),
        sa.Column("architecture", sa.String(), primary_key=True),
        sa.Column("downloads", sa.BigInteger(), nullable=False),
        sa.Column("updates", sa.BigInteger(), nullable=False),
    )
    op.create_table(
        "stats_global",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_stats_global_singleton"),
    )


def downgrade():
    op.drop_table("stats_global")
    op.drop_table("stats_daily_ref")
    op.drop_table("stats_daily")

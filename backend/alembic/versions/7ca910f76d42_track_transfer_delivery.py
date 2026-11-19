"""Track payout claims and provider confirmations."""

import sqlalchemy as sa
from alembic import op

revision = "7ca910f76d42"
down_revision = "91d3a62f804b"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "stripefailedpaymentevent", sa.Column("event_id", sa.String(), primary_key=True)
    )
    op.create_table(
        "stripetransferdelivery",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column(
            "stripe_transaction",
            sa.Integer(),
            sa.ForeignKey("stripetransaction.id"),
            nullable=False,
        ),
        sa.Column("recipient", sa.String(), nullable=False),
        sa.Column("currency", sa.String(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("claimed_at", sa.DateTime(), nullable=False),
        sa.Column("outcome", sa.String(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("stripe_transfer_id", sa.String(), unique=True),
    )


def downgrade():
    op.execute("LOCK TABLE stripetransferdelivery IN ACCESS EXCLUSIVE MODE")
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT FROM stripetransferdelivery) THEN
                RAISE EXCEPTION 'Archive and reconcile transfer deliveries before downgrade';
            END IF;
        END $$;
    """)
    op.drop_table("stripetransferdelivery")
    op.drop_table("stripefailedpaymentevent")

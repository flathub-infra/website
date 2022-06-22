"""Vending constraints

Revision ID: 045d9e1bf830
Revises: 180bf9e57e38
Create Date: 2022-06-22 14:37:00.161453

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "045d9e1bf830"
down_revision = "180bf9e57e38"
branch_labels = None
depends_on = None


def upgrade():
    # This is a manually created constraint migration covering the
    # constraints for ApplicationVendingConfig
    tname = "applicationvendingconfig"
    op.create_check_constraint(
        condition="appshare >= 10 and appshare <= 100",
        constraint_name="vending_appshare_in_range",
        table_name=tname,
    )
    op.create_check_constraint(
        condition="currency = 'usd'",
        constraint_name="currency_must_be_dollars",
        table_name=tname,
    )
    op.create_check_constraint(
        condition="recommended_donation >= minimum_payment",
        constraint_name="vending_donation_not_too_small",
        table_name=tname,
    )
    op.create_check_constraint(
        condition="recommended_donation > 100",
        constraint_name="vending_donation_at_least_one_dollar",
        table_name=tname,
    )
    op.create_check_constraint(
        condition="minimum_payment >= 0",
        constraint_name="vending_payment_not_negative",
        table_name=tname,
    )


def downgrade():
    tname = "applicationvendingconfig"
    op.drop_constraint(
        constraint_name="vending_appshare_in_range",
        table_name=tname,
    )
    op.drop_constraint(
        constraint_name="currency_must_be_dollars",
        table_name=tname,
    )
    op.drop_constraint(
        constraint_name="vending_donation_not_too_small",
        table_name=tname,
    )
    op.drop_constraint(
        constraint_name="vending_donation_at_least_one_dollar",
        table_name=tname,
    )
    op.drop_constraint(
        constraint_name="vending_payment_not_negative",
        table_name=tname,
    )

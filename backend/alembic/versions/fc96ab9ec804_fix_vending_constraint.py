"""fix-vending-constraint

Revision ID: fc96ab9ec804
Revises: a0c787564b32
Create Date: 2022-08-10 15:27:50.461887

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "fc96ab9ec804"
down_revision = "a0c787564b32"
branch_labels = None
depends_on = None


def upgrade():
    tname = "applicationvendingconfig"
    op.drop_constraint(
        constraint_name="vending_donation_at_least_one_dollar",
        table_name=tname,
    )
    op.create_check_constraint(
        condition="recommended_donation >= 100",
        constraint_name="vending_donation_at_least_one_dollar",
        table_name=tname,
    )


def downgrade():
    tname = "applicationvendingconfig"
    op.drop_constraint(
        constraint_name="vending_donation_at_least_one_dollar",
        table_name=tname,
    )
    op.create_check_constraint(
        condition="recommended_donation > 100",
        constraint_name="vending_donation_at_least_one_dollar",
        table_name=tname,
    )

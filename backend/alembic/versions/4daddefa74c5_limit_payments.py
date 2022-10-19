"""limit-payments

Revision ID: 4daddefa74c5
Revises: fc96ab9ec804
Create Date: 2022-10-19 13:07:27.599006

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4daddefa74c5'
down_revision = 'fc96ab9ec804'
branch_labels = None
depends_on = None


def upgrade():
    op.create_check_constraint(
        condition="recommended_donation <= 99999999",
        constraint_name="vending_donation_less_than_million",
        table_name='applicationvendingconfig',
    )
    op.create_check_constraint(
        condition="minimum_payment <= 99999999",
        constraint_name="minimum_payment_less_than_million",
        table_name='applicationvendingconfig',
    )

def downgrade():
    op.drop_constraint(
        constraint_name="vending_donation_less_than_million",
        table_name='applicationvendingconfig',
    )
    op.drop_constraint(
        constraint_name="minimum_payment_less_than_million",
        table_name='applicationvendingconfig',
    )


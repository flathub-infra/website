"""migrate eol_branches to proper array format

Revision ID: ffe020a2c0dd
Revises: 5db3ed6373fc
Create Date: 2025-02-27 13:07:31.003324

"""
from alembic import op
import sqlalchemy as sa
import json
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import Column, select, table, column


# revision identifiers, used by Alembic.
revision = 'ffe020a2c0dd'
down_revision = '5db3ed6373fc'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    
    apps_table = table(
        'apps',
        column('id'),
        column('app_id'),
        column('eol_branches')
    )
    
    rows = connection.execute(
        select(apps_table.c.id, apps_table.c.app_id, apps_table.c.eol_branches)
        .where(apps_table.c.eol_branches != None)
    ).fetchall()
    
    for row in rows:
        eol_branches = row[2]
        app_id = row[1]
        
        if eol_branches and not isinstance(eol_branches, list):
            try:
                if isinstance(eol_branches, str):
                    eol_branches = json.loads(eol_branches)
                
                if not isinstance(eol_branches, list):
                    eol_branches = [eol_branches]
                
                connection.execute(
                    apps_table.update()
                    .where(apps_table.c.id == row[0])
                    .values(eol_branches=eol_branches)
                )
                print(f"Converted eol_branches for {app_id} to {eol_branches}")
            except Exception as e:
                print(f"Error converting eol_branches for {app_id}: {str(e)}")


def downgrade():
    pass

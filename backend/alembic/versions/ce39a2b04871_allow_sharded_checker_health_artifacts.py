"""Allow sharded checker health artifacts.

Revision ID: ce39a2b04871
Revises: ab6e923cf014
"""

from alembic import op

revision = "ce39a2b04871"
down_revision = "ab6e923cf014"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index(
        "ix_checkerhealthartifact_run_attempt", table_name="checkerhealthartifact"
    )


def downgrade():
    op.execute(
        "LOCK TABLE checkerhealthartifact, checkerhealthobservation "
        "IN ACCESS EXCLUSIVE MODE"
    )
    # The old schema can keep only one report per app and run attempt.
    op.execute("""
        WITH ranked AS (
            SELECT artifact_id, app_id,
                   row_number() OVER (
                       PARTITION BY run_id, run_attempt, app_id
                       ORDER BY observed_at DESC, artifact_id DESC
                   ) AS position
            FROM checkerhealthobservation
        )
        DELETE FROM checkerhealthobservation AS observation
        USING ranked
        WHERE observation.artifact_id = ranked.artifact_id
          AND observation.app_id = ranked.app_id
          AND ranked.position > 1
    """)
    op.execute("""
        UPDATE checkerhealthobservation AS observation
        SET artifact_id = retained.artifact_id
        FROM (
            SELECT run_id, run_attempt, min(artifact_id) AS artifact_id
            FROM checkerhealthartifact
            GROUP BY run_id, run_attempt
        ) AS retained
        WHERE observation.run_id = retained.run_id
          AND observation.run_attempt = retained.run_attempt
          AND observation.artifact_id <> retained.artifact_id
    """)
    op.execute("""
        DELETE FROM checkerhealthartifact AS artifact
        USING (
            SELECT run_id, run_attempt, min(artifact_id) AS artifact_id
            FROM checkerhealthartifact
            GROUP BY run_id, run_attempt
        ) AS retained
        WHERE artifact.run_id = retained.run_id
          AND artifact.run_attempt = retained.run_attempt
          AND artifact.artifact_id <> retained.artifact_id
    """)
    op.create_index(
        "ix_checkerhealthartifact_run_attempt",
        "checkerhealthartifact",
        ["run_id", "run_attempt"],
        unique=True,
    )

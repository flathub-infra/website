from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '518a0e462ba8'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('manifestanalysisobservation',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('app_id', sa.String(), nullable=False),
    sa.Column('build_id', sa.Integer(), nullable=False),
    sa.Column('job_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('appstream_present', sa.Boolean(), nullable=False),
    sa.Column('is_new_submission', sa.Boolean(), nullable=False),
    sa.Column('policy_context', sa.String(), nullable=False),
    sa.Column('candidate_ref_count', sa.Integer(), nullable=False),
    sa.Column('collected_ref_count', sa.Integer(), nullable=False),
    sa.Column('comparable_ref_count', sa.Integer(), nullable=False),
    sa.Column('collection_status', sa.String(), nullable=False),
    sa.Column('collection_error_category', sa.String(), nullable=True),
    sa.Column('source_status', sa.String(), nullable=False),
    sa.Column('source_findings', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('source_would_gate', sa.Boolean(), nullable=False),
    sa.Column('complexity_status', sa.String(), nullable=False),
    sa.Column('complexity_algorithm_version', sa.Integer(), nullable=False),
    sa.Column('complexity_threshold_units', sa.Integer(), nullable=False),
    sa.Column('complexity_score_units', sa.Integer(), nullable=True),
    sa.Column('complexity_raw_score_units', sa.Integer(), nullable=True),
    sa.Column('complexity_score_band', sa.String(), nullable=True),
    sa.Column('complexity_not_scored_reason', sa.String(), nullable=True),
    sa.Column('complexity_analysis_fingerprint', sa.String(), nullable=True),
    sa.Column('complexity_would_gate', sa.Boolean(), nullable=False),
    sa.Column('complexity_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('source_gating_enabled', sa.Boolean(), nullable=False),
    sa.Column('source_observe_only', sa.Boolean(), nullable=False),
    sa.Column('complexity_gating_enabled', sa.Boolean(), nullable=False),
    sa.Column('complexity_observe_only', sa.Boolean(), nullable=False),
    sa.Column('moderation_observe_only', sa.Boolean(), nullable=False),
    sa.CheckConstraint("(complexity_status = 'scored' AND complexity_score_units IS NOT NULL AND complexity_raw_score_units IS NOT NULL AND complexity_score_band IS NOT NULL AND complexity_analysis_fingerprint IS NOT NULL AND complexity_data IS NOT NULL AND complexity_not_scored_reason IS NULL) OR (complexity_status = 'not_scored' AND complexity_score_units IS NULL AND complexity_raw_score_units IS NULL AND complexity_score_band IS NULL AND complexity_analysis_fingerprint IS NULL AND complexity_data IS NULL AND complexity_not_scored_reason IN ('initial_submission', 'candidate_manifest_unavailable', 'published_ref_missing', 'published_manifest_missing', 'published_manifest_invalid', 'no_manifest_groups', 'unsupported_manifest_structure'))", name='manifestanalysisobservation_complexity_values'),
    sa.CheckConstraint("collection_status IN ('complete', 'partial', 'failed', 'unavailable')", name='manifestanalysisobservation_collection_status'),
    sa.CheckConstraint("complexity_status IN ('scored', 'not_scored')", name='manifestanalysisobservation_complexity_status'),
    sa.CheckConstraint("policy_context IN ('normal', 'initial_submission', 'initial_vorarbeiter', 'skip_list', 'missing_appstream')", name='manifestanalysisobservation_policy_context'),
    sa.CheckConstraint("source_status != 'clean' OR (collection_status = 'complete' AND candidate_ref_count = collected_ref_count AND collected_ref_count = comparable_ref_count)", name='manifestanalysisobservation_clean_source_coverage'),
    sa.CheckConstraint("source_status IN ('clean', 'findings', 'unavailable')", name='manifestanalysisobservation_source_status'),
    sa.CheckConstraint('candidate_ref_count >= 0 AND collected_ref_count >= 0 AND comparable_ref_count >= 0 AND collected_ref_count <= candidate_ref_count AND comparable_ref_count <= collected_ref_count', name='manifestanalysisobservation_coverage_counts'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_manifestanalysisobservation_app_id_created_at', 'manifestanalysisobservation', ['app_id', 'created_at'], unique=False)
    op.create_index('ix_manifestanalysisobservation_created_at', 'manifestanalysisobservation', ['created_at'], unique=False)
    op.create_index('manifestanalysisobservation_build_app_unique', 'manifestanalysisobservation', ['build_id', 'app_id'], unique=True)


def downgrade():
    op.drop_index('manifestanalysisobservation_build_app_unique', table_name='manifestanalysisobservation')
    op.drop_index('ix_manifestanalysisobservation_created_at', table_name='manifestanalysisobservation')
    op.drop_index('ix_manifestanalysisobservation_app_id_created_at', table_name='manifestanalysisobservation')
    op.drop_table('manifestanalysisobservation')

from alembic import op


revision = "00ab42ba9c5e"
down_revision = "e6c796a1bdf3"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("permissionrule_group", "permissionrule", type_="check")
    op.create_check_constraint(
        "permissionrule_group",
        "permissionrule",
        "permission_group IN "
        "('Application', 'Context', 'Session Bus Policy', 'System Bus Policy', "
        "'USB Devices')",
    )
    op.drop_constraint("permissionrule_match_type", "permissionrule", type_="check")
    op.create_check_constraint(
        "permissionrule_match_type",
        "permissionrule",
        "(permission_group <> 'Application' OR match_type = 'transition') "
        "AND ((match_type = 'destination' AND before IS NULL "
        "AND value IS NOT NULL AND removed IS NULL AND added IS NULL) "
        "OR (match_type = 'transition' AND num_nonnulls(before, value) > 0 "
        "AND before IS DISTINCT FROM value AND removed IS NULL AND added IS NULL) "
        "OR (match_type = 'grouped-delta' AND before IS NULL AND value IS NULL "
        "AND permissionrule_valid_delta(removed, added) "
        "AND (permission_group = 'USB Devices' OR (permission_group = 'Context' "
        "AND key IN ('shared', 'sockets', 'devices', 'features', 'filesystems', 'persistent')))))",
    )


def downgrade():
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM permissionrule
                WHERE permission_group = 'Application'
            ) THEN
                RAISE EXCEPTION 'Cannot downgrade application permission rules';
            END IF;
        END $$;
        """
    )
    op.drop_constraint("permissionrule_match_type", "permissionrule", type_="check")
    op.create_check_constraint(
        "permissionrule_match_type",
        "permissionrule",
        "(match_type = 'destination' AND before IS NULL AND value IS NOT NULL "
        "AND removed IS NULL AND added IS NULL) "
        "OR (match_type = 'transition' AND num_nonnulls(before, value) > 0 "
        "AND before IS DISTINCT FROM value AND removed IS NULL AND added IS NULL) "
        "OR (match_type = 'grouped-delta' AND before IS NULL AND value IS NULL "
        "AND permissionrule_valid_delta(removed, added) "
        "AND (permission_group = 'USB Devices' OR (permission_group = 'Context' "
        "AND key IN ('shared', 'sockets', 'devices', 'features', 'filesystems', 'persistent'))))",
    )
    op.drop_constraint("permissionrule_group", "permissionrule", type_="check")
    op.create_check_constraint(
        "permissionrule_group",
        "permissionrule",
        "permission_group IN "
        "('Context', 'Session Bus Policy', 'System Bus Policy', 'USB Devices')",
    )

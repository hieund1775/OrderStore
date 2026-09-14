-- Read-only production preflight for 0033_preorder_customer_checkin.sql.
-- Every row must be PASS/0 for the production executor to proceed.
WITH required_base_tables(table_name) AS (
    VALUES
      ('users'), ('preorders'), ('stores'),
      ('preorder_confirmation_incidents'),
      ('manager_preorder_strikes'),
      ('preorder_notification_deliveries')
),
required_base_columns(table_name, column_name) AS (
    VALUES
      ('preorders', 'id'),
      ('preorders', 'preorder_code'),
      ('preorders', 'store_id'),
      ('preorders', 'customer_user_id'),
      ('preorders', 'scheduled_start_at'),
      ('preorders', 'scheduled_end_at'),
      ('preorders', 'status'),
      ('preorders', 'responsible_manager_id'),
      ('users', 'id'),
      ('stores', 'id')
),
table_checks AS (
    SELECT
      'required_base_tables'::text AS check_name,
      COUNT(*) FILTER (WHERE t.table_name IS NULL)::bigint AS issue_count
    FROM required_base_tables r
    LEFT JOIN information_schema.tables t
      ON t.table_schema = current_schema() AND t.table_name = r.table_name
),
column_checks AS (
    SELECT
      'preorders_required_columns'::text AS check_name,
      COUNT(*) FILTER (WHERE c.column_name IS NULL)::bigint AS issue_count
    FROM required_base_columns r
    LEFT JOIN information_schema.columns c
      ON c.table_schema = current_schema()
     AND c.table_name = r.table_name
     AND c.column_name = r.column_name
),
existing_checkin_shape_checks AS (
    SELECT
      'checkin_objects_absent_or_compatible'::text AS check_name,
      COUNT(*) FILTER (WHERE t.table_name IS NOT NULL AND c.column_name IS NULL)::bigint AS issue_count
    FROM (VALUES
      ('preorder_checkin_requests', 'id'),
      ('preorder_checkin_requests', 'preorder_id'),
      ('preorder_checkin_requests', 'store_id'),
      ('preorder_checkin_requests', 'customer_user_id'),
      ('preorder_checkin_requests', 'scheduled_start_at'),
      ('preorder_checkin_requests', 'scheduled_end_at'),
      ('preorder_checkin_requests', 'requested_at'),
      ('preorder_checkin_requests', 'status'),
      ('preorder_checkin_requests', 'resolved_by'),
      ('preorder_checkin_requests', 'resolved_at'),
      ('preorder_checkin_requests', 'rejection_reason'),
      ('preorder_checkin_requests', 'late_confirmation_reason'),
      ('preorder_checkin_requests', 'manager_breach_recorded_at'),
      ('preorder_checkin_requests', 'created_at'),
      ('preorder_checkin_requests', 'updated_at'),
      ('preorder_slot_strike_events', 'id'),
      ('preorder_slot_strike_events', 'preorder_id'),
      ('preorder_slot_strike_events', 'scheduled_start_at'),
      ('preorder_slot_strike_events', 'manager_id'),
      ('preorder_slot_strike_events', 'strike_source'),
      ('preorder_slot_strike_events', 'created_at')
    ) AS expected(table_name, column_name)
    LEFT JOIN information_schema.tables t
      ON t.table_schema = current_schema() AND t.table_name = expected.table_name
    LEFT JOIN information_schema.columns c
      ON c.table_schema = current_schema()
     AND c.table_name = expected.table_name
     AND c.column_name = expected.column_name
),
tracker_checks AS (
    SELECT
      'migration_tracker_0033_checksum_conflict'::text AS check_name,
      CASE WHEN EXISTS (
        SELECT 1 FROM schema_migrations WHERE version = '0033'
      ) THEN 1 ELSE 0 END::bigint AS issue_count
),
checks AS (
    SELECT * FROM table_checks
    UNION ALL SELECT * FROM column_checks
    UNION ALL SELECT * FROM existing_checkin_shape_checks
    UNION ALL SELECT * FROM tracker_checks
)
SELECT check_name, issue_count, CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;

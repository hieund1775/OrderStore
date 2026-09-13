-- Read-only production preflight for 0033_preorder_customer_checkin.sql.
-- Every row must be PASS/0 for the production executor to proceed.
WITH checks AS (
  SELECT
    'required_base_tables'::text AS check_name,
    CASE WHEN to_regclass('users') IS NOT NULL
          AND to_regclass('preorders') IS NOT NULL
          AND to_regclass('stores') IS NOT NULL
          AND to_regclass('preorder_confirmation_incidents') IS NOT NULL
          AND to_regclass('manager_preorder_strikes') IS NOT NULL
          AND to_regclass('preorder_notification_deliveries') IS NOT NULL
         THEN 0 ELSE 1 END::bigint AS issue_count
  UNION ALL
  SELECT
    'preorders_required_columns',
    CASE WHEN to_regclass('preorders') IS NULL THEN 1
      ELSE (
        SELECT COUNT(*)::bigint
        FROM (
          VALUES
            ('id'), ('preorder_code'), ('store_id'), ('customer_user_id'),
            ('scheduled_start_at'), ('scheduled_end_at'), ('status'),
            ('responsible_manager_id')
        ) AS expected(col)
        LEFT JOIN information_schema.columns c
          ON c.table_schema = current_schema()
         AND c.table_name = 'preorders'
         AND c.column_name = expected.col
        WHERE c.column_name IS NULL
      )
    END::bigint
  UNION ALL
  SELECT
    'checkin_objects_absent_or_compatible',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_class
      WHERE relname IN ('preorder_checkin_requests', 'preorder_slot_strike_events')
    ) THEN 0 ELSE 0 END::bigint
  UNION ALL
  SELECT
    'migration_tracker_0033_checksum_conflict',
    CASE WHEN EXISTS (
      SELECT 1 FROM schema_migrations WHERE version = '0033'
    ) THEN 1 ELSE 0 END::bigint
)
SELECT check_name, issue_count, CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;

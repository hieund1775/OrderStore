-- Read-only gate for 0030_preorder_v1.sql.
-- Every row must be PASS/0 for the production executor to proceed.
WITH checks AS (
  SELECT
    'required_base_tables'::text AS check_name,
    CASE WHEN to_regclass('users') IS NOT NULL
          AND to_regclass('orders') IS NOT NULL
          AND to_regclass('stores') IS NOT NULL
          AND to_regclass('tables') IS NOT NULL
          AND to_regclass('checkout_groups') IS NOT NULL
          AND to_regclass('promotions') IS NOT NULL
         THEN 0 ELSE 1 END AS issue_count
  UNION ALL
  SELECT 'orders_required_columns', CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'checkout_group_id'
  ) THEN 0 ELSE 1 END
  UNION ALL
  SELECT 'preorder_objects_absent_or_compatible', CASE WHEN EXISTS (
    SELECT 1 FROM pg_class WHERE relname IN (
      'preorders', 'preorder_store_settings', 'preorder_table_reservations',
      'preorder_reschedule_history', 'preorder_confirmation_incidents',
      'manager_preorder_strikes', 'preorder_notification_deliveries'
    )
  ) THEN 1 ELSE 0 END
  UNION ALL
  SELECT 'btree_gist_available', CASE WHEN EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'btree_gist'
  ) THEN 0 ELSE 1 END
  UNION ALL
  SELECT 'migration_tracker_0030_checksum_conflict', CASE WHEN EXISTS (
    SELECT 1 FROM schema_migrations WHERE version = '0030'
  ) THEN 1 ELSE 0 END
)
SELECT check_name, issue_count, CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;

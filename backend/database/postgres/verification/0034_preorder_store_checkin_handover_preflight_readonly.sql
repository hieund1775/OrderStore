-- Read-only production preflight for 0034_preorder_store_checkin_handover.sql.
WITH checks AS (
  SELECT
    'preorders_exists'::text AS check_name,
    CASE WHEN to_regclass('preorders') IS NOT NULL THEN 0 ELSE 1 END::bigint AS issue_count
  UNION ALL
  SELECT
    'users_exists',
    CASE WHEN to_regclass('users') IS NOT NULL THEN 0 ELSE 1 END::bigint
  UNION ALL
  SELECT
    'preorders_status_column_exists',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'preorders'
        AND column_name = 'status'
    ) THEN 0 ELSE 1 END::bigint
  UNION ALL
  SELECT
    'incompatible_handover_confirmed_at',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'preorders'
        AND column_name = 'handover_confirmed_at'
        AND data_type <> 'timestamp with time zone'
    ) THEN 1 ELSE 0 END::bigint
  UNION ALL
  SELECT
    'incompatible_handover_confirmed_by',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'preorders'
        AND column_name = 'handover_confirmed_by'
        AND data_type <> 'bigint'
    ) THEN 1 ELSE 0 END::bigint
  UNION ALL
  SELECT
    'incompatible_handover_overdue_at',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'preorders'
        AND column_name = 'handover_overdue_at'
        AND data_type <> 'timestamp with time zone'
    ) THEN 1 ELSE 0 END::bigint
)
SELECT check_name, issue_count, CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;

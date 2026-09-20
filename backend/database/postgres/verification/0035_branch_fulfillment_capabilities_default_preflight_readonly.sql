-- Read-only production preflight for 0035_branch_fulfillment_capabilities_default.sql.
WITH checks AS (
  SELECT
    'branch_fulfillment_capabilities_exists'::text AS check_name,
    CASE WHEN to_regclass('branch_fulfillment_capabilities') IS NOT NULL THEN 0 ELSE 1 END::bigint AS issue_count
  UNION ALL
  SELECT
    'fulfillment_lane_registry_exists',
    CASE WHEN to_regclass('fulfillment_lane_registry') IS NOT NULL THEN 0 ELSE 1 END::bigint
  UNION ALL
  SELECT
    'stores_exists',
    CASE WHEN to_regclass('stores') IS NOT NULL THEN 0 ELSE 1 END::bigint
)
SELECT check_name, issue_count, CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;

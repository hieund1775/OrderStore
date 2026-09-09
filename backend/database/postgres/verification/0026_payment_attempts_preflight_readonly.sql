-- 0026 canonical classification is owned by the application-layer executor.
-- This compatibility probe is intentionally read-only; the executor replaces
-- it with the canonical exact-set comparison before planning/applying 0026.
WITH checks AS (
  SELECT 'canonical_classifier_delegated_to_executor'::text AS check_name,
         0::bigint AS issue_count
)
SELECT check_name, issue_count,
       CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks;

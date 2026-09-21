-- Read-only production preflight for 0036_scoped_category_uniqueness.sql.
WITH checks AS (
  SELECT
    'categories_table_exists'::text AS check_name,
    CASE WHEN to_regclass('categories') IS NOT NULL THEN 0 ELSE 1 END::bigint AS issue_count
  UNION ALL
  SELECT
    'no_duplicate_active_root_category_names',
    COUNT(*)::bigint
  FROM (
    SELECT name
    FROM categories
    WHERE parent_id IS NULL AND archived_at IS NULL
    GROUP BY name
    HAVING COUNT(*) > 1
  ) dups
  UNION ALL
  SELECT
    'no_duplicate_active_subcategories_in_same_parent',
    COUNT(*)::bigint
  FROM (
    SELECT parent_id, name
    FROM categories
    WHERE parent_id IS NOT NULL AND archived_at IS NULL
    GROUP BY parent_id, name
    HAVING COUNT(*) > 1
  ) subdups
)
SELECT check_name, issue_count, CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;

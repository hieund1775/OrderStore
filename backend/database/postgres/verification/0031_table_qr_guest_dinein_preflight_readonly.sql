-- Read-only production preflight for 0031_table_qr_guest_dinein.sql.
WITH checks AS (
  SELECT
    'tables_exists'::text AS check_name,
    CASE WHEN to_regclass('tables') IS NOT NULL THEN 0 ELSE 1 END::bigint AS issue_count
  UNION ALL
  SELECT
    'promotions_exists',
    CASE WHEN to_regclass('promotions') IS NOT NULL THEN 0 ELSE 1 END::bigint
  UNION ALL
  SELECT
    'orders_exists',
    CASE WHEN to_regclass('orders') IS NOT NULL THEN 0 ELSE 1 END::bigint
  UNION ALL
  SELECT
    'orders_order_type_constraint_compatible',
    CASE WHEN to_regclass('orders') IS NULL THEN 1
      ELSE (
        SELECT COUNT(*)::bigint
        FROM orders
        WHERE order_type IS NULL
           OR order_type NOT IN ('Delivery', 'Take-away', 'POS', 'Dine-in')
      )
    END::bigint
  UNION ALL
  SELECT
    'incompatible_qr_checkout_token_hash',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'tables'
        AND column_name = 'qr_checkout_token_hash'
        AND (data_type <> 'character' OR character_maximum_length <> 64)
    ) THEN 1 ELSE 0 END::bigint
  UNION ALL
  SELECT
    'incompatible_applies_to_table_qr',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'promotions'
        AND column_name = 'applies_to_table_qr'
        AND data_type <> 'boolean'
    ) THEN 1 ELSE 0 END::bigint
)
SELECT check_name, issue_count, CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;

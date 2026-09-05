-- Restore approved industry roots that were reparented under root 33 by
-- legacy-root-category-navigation-v1. This is intentionally fail-closed.
-- It does not clean up root 33, alter descendants, create mappings, or touch
-- order/payment snapshots.

DO $$
DECLARE
  target_count INTEGER;
  category_one_profile_code TEXT;
  category_one_profile_purpose TEXT;
  category_one_profile_status TEXT;
  category_one_mapping_active BOOLEAN;
BEGIN
  -- The three approved roots must still be exactly in their audited state.
  SELECT COUNT(*) INTO target_count
  FROM categories
  WHERE (id, parent_id, depth, archived_at IS NULL) IN (
    (1, 33, 1, TRUE),
    (14, 33, 1, TRUE),
    (15, 33, 1, TRUE)
  );
  IF target_count <> 3 THEN
    RAISE EXCEPTION '0025 precondition failed: categories 1, 14, and 15 must be active direct children of root 33 at depth 1';
  END IF;

  -- Root 33 itself must remain a valid root; this migration never removes it.
  IF NOT EXISTS (
    SELECT 1
    FROM categories
    WHERE id = 33 AND parent_id IS NULL AND depth = 0 AND archived_at IS NULL
  ) THEN
    RAISE EXCEPTION '0025 precondition failed: category 33 is not an active root';
  END IF;

  -- Descendants were audited as already correct for their future restored parents.
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      (22::BIGINT, 15::BIGINT, 1),
      (24::BIGINT, 14::BIGINT, 1),
      (25::BIGINT, 14::BIGINT, 1)
    ) AS expected(id, expected_parent_id, expected_depth)
    LEFT JOIN categories c ON c.id = expected.id
    WHERE c.id IS NULL
      OR c.parent_id IS DISTINCT FROM expected.expected_parent_id
      OR c.depth IS DISTINCT FROM expected.expected_depth
  ) THEN
    RAISE EXCEPTION '0025 precondition failed: descendants 22, 24, and 25 no longer match their audited parent/depth';
  END IF;

  -- Categories 14 and 15 are intentionally unmapped until an owner/profile is approved.
  IF EXISTS (
    SELECT 1
    FROM category_payment_profiles
    WHERE root_category_id IN (14, 15)
  ) THEN
    RAISE EXCEPTION '0025 precondition failed: categories 14 and 15 must not have payment mappings';
  END IF;

  -- GROUP_CHECKOUT and DEFAULT_PROFILE never map to an industry category.
  IF EXISTS (
    SELECT 1
    FROM category_payment_profiles cpp
    JOIN payment_profiles pp ON pp.id = cpp.payment_profile_id
    WHERE cpp.root_category_id IN (1, 14, 15)
      AND pp.code IN ('GROUP_CHECKOUT', 'DEFAULT_PROFILE')
  ) THEN
    RAISE EXCEPTION '0025 precondition failed: GROUP_CHECKOUT and DEFAULT_PROFILE cannot be category mappings';
  END IF;

  -- Category 1 may only carry the exact audited legacy mapping. It is retained
  -- for history but disabled below so restoring the root cannot enable new P0 traffic.
  SELECT pp.code, pp.purpose, pp.status, cpp.is_active
  INTO category_one_profile_code, category_one_profile_purpose,
       category_one_profile_status, category_one_mapping_active
  FROM category_payment_profiles cpp
  JOIN payment_profiles pp ON pp.id = cpp.payment_profile_id
  WHERE cpp.root_category_id = 1;

  IF NOT FOUND
    OR category_one_profile_code <> 'DEFAULT_LONG'
    OR category_one_profile_purpose <> 'industry'
    OR category_one_profile_status <> 'active'
    OR category_one_mapping_active IS NOT TRUE THEN
    RAISE EXCEPTION '0025 precondition failed: category 1 must have one active DEFAULT_LONG industry mapping before it can be retained as disabled history';
  END IF;

  -- Restore only the approved roots. Existing IDs, slugs, products, orders,
  -- payment snapshots, fixtures, and root 33 are intentionally untouched.
  UPDATE categories
  SET parent_id = NULL,
      depth = 0
  WHERE id IN (1, 14, 15)
    AND parent_id = 33
    AND depth = 1;

  -- Preserve the legacy mapping row for audit/history, but prevent DEFAULT_LONG
  -- from being selected for new direct P0 checkout after category 1 is a root.
  UPDATE category_payment_profiles cpp
  SET is_active = FALSE,
      updated_at = CURRENT_TIMESTAMP
  FROM payment_profiles pp
  WHERE cpp.payment_profile_id = pp.id
    AND cpp.root_category_id = 1
    AND pp.code = 'DEFAULT_LONG'
    AND cpp.is_active = TRUE;
END $$;

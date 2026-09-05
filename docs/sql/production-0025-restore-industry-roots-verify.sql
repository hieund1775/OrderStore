-- Post-0025 verification — READ ONLY. Run only after migration 0025 succeeds.

-- Result 1: restored roots and unchanged audited descendants.
SELECT
  id,
  name,
  slug,
  parent_id,
  depth,
  archived_at
FROM categories
WHERE id IN (1, 14, 15, 22, 24, 25, 33)
ORDER BY id ASC;

-- Result 2: category mappings must show disabled DEFAULT_LONG history for 1,
-- and no mapping rows for 14 or 15.
SELECT
  cpp.root_category_id,
  cpp.is_active AS mapping_is_active,
  pp.code AS payment_profile_code,
  pp.purpose AS payment_profile_purpose,
  pp.status AS payment_profile_status
FROM category_payment_profiles cpp
JOIN payment_profiles pp ON pp.id = cpp.payment_profile_id
WHERE cpp.root_category_id IN (1, 14, 15)
ORDER BY cpp.root_category_id ASC;

-- Result 3: order/payment snapshots remain present and are not rewritten.
SELECT
  'orders' AS source,
  root_category_id,
  COUNT(*) AS reference_count
FROM orders
WHERE root_category_id IN (1, 14, 15)
GROUP BY root_category_id

UNION ALL

SELECT
  'checkout_group_allocations' AS source,
  root_category_id,
  COUNT(*) AS reference_count
FROM checkout_group_allocations
WHERE root_category_id IN (1, 14, 15)
GROUP BY root_category_id
ORDER BY source ASC, root_category_id ASC;

-- Result 4: root 33 remains; no fixture cleanup is part of 0025.
SELECT
  id,
  name,
  slug,
  parent_id,
  depth,
  archived_at
FROM categories
WHERE id = 33;

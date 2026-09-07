-- P1 / phase 0027 preflight. Read-only: every row below must report 0 before
-- applying enforcement. Any non-zero result is a fail-closed migration blocker.
WITH checks AS (
  SELECT 'attempt_target_shape'::text AS check_name, COUNT(*)::bigint AS issue_count
  FROM payment_attempts pa
  WHERE NOT (
    (pa.target_type = 'order' AND pa.order_id IS NOT NULL AND pa.checkout_group_id IS NULL)
    OR (pa.target_type = 'checkout_group' AND pa.checkout_group_id IS NOT NULL AND pa.order_id IS NULL)
  )

  UNION ALL
  SELECT 'group_child_direct_attempt', COUNT(*)::bigint
  FROM payment_attempts pa
  JOIN orders o ON o.id = pa.order_id
  WHERE pa.target_type = 'order' AND o.checkout_group_id IS NOT NULL

  UNION ALL
  SELECT 'group_child_current_pointer', COUNT(*)::bigint
  FROM orders o
  WHERE o.checkout_group_id IS NOT NULL AND o.current_payment_attempt_id IS NOT NULL

  UNION ALL
  SELECT 'order_current_pointer_mismatch', COUNT(*)::bigint
  FROM orders o
  LEFT JOIN payment_attempts pa ON pa.id = o.current_payment_attempt_id
  WHERE o.current_payment_attempt_id IS NOT NULL
    AND (pa.id IS NULL OR pa.target_type <> 'order' OR pa.order_id <> o.id OR pa.checkout_group_id IS NOT NULL)

  UNION ALL
  SELECT 'group_current_pointer_mismatch', COUNT(*)::bigint
  FROM checkout_groups cg
  LEFT JOIN payment_attempts pa ON pa.id = cg.current_payment_attempt_id
  WHERE cg.current_payment_attempt_id IS NOT NULL
    AND (pa.id IS NULL OR pa.target_type <> 'checkout_group' OR pa.checkout_group_id <> cg.id OR pa.order_id IS NOT NULL)

  UNION ALL
  SELECT 'duplicate_creating_order', COUNT(*)::bigint
  FROM (
    SELECT order_id FROM payment_attempts
    WHERE target_type = 'order' AND status = 'creating'
    GROUP BY order_id HAVING COUNT(*) > 1
  ) duplicates

  UNION ALL
  SELECT 'duplicate_creating_group', COUNT(*)::bigint
  FROM (
    SELECT checkout_group_id FROM payment_attempts
    WHERE target_type = 'checkout_group' AND status = 'creating'
    GROUP BY checkout_group_id HAVING COUNT(*) > 1
  ) duplicates

  UNION ALL
  SELECT 'duplicate_provider_order_identity', COUNT(*)::bigint
  FROM (
    SELECT provider, payment_profile_code, provider_order_code
    FROM payment_attempts
    WHERE provider_order_code IS NOT NULL
    GROUP BY provider, payment_profile_code, provider_order_code HAVING COUNT(*) > 1
  ) duplicates

  UNION ALL
  SELECT 'duplicate_provider_link_identity', COUNT(*)::bigint
  FROM (
    SELECT provider, payment_profile_code, provider_payment_link_id
    FROM payment_attempts
    WHERE provider_payment_link_id IS NOT NULL
    GROUP BY provider, payment_profile_code, provider_payment_link_id HAVING COUNT(*) > 1
  ) duplicates

  UNION ALL
  SELECT 'duplicate_event_identity', COUNT(*)::bigint
  FROM (
    SELECT provider, payment_profile_code, provider_payment_identity
    FROM payment_events
    WHERE payment_profile_code IS NOT NULL AND provider_payment_identity IS NOT NULL
    GROUP BY provider, payment_profile_code, provider_payment_identity HAVING COUNT(*) > 1
  ) duplicates
)
SELECT check_name, issue_count, CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;

-- P1 / phase 0026 production preflight. Read-only: all issue_count values
-- must be zero before the additive backfill can be applied safely.
WITH checks AS (
  SELECT 'group_child_direct_payos_artifacts'::text AS check_name, COUNT(*)::bigint AS issue_count
  FROM orders o
  WHERE o.checkout_group_id IS NOT NULL
    AND (o.payos_order_code IS NOT NULL OR o.payment_link_id IS NOT NULL
      OR o.payment_checkout_url IS NOT NULL OR o.payment_qr_code IS NOT NULL
      OR o.payment_created_at IS NOT NULL OR o.payment_expires_at IS NOT NULL)

  UNION ALL
  SELECT 'legacy_artifact_wrong_provider', COUNT(*)::bigint
  FROM (
    SELECT payment_provider, payos_order_code, payment_link_id, payment_checkout_url, payment_qr_code, payment_created_at, payment_expires_at FROM orders
    UNION ALL
    SELECT payment_provider, payos_order_code, payment_link_id, payment_checkout_url, payment_qr_code, payment_created_at, payment_expires_at FROM checkout_groups
  ) legacy
  WHERE (payos_order_code IS NOT NULL OR payment_link_id IS NOT NULL OR payment_checkout_url IS NOT NULL
    OR payment_qr_code IS NOT NULL OR payment_created_at IS NOT NULL OR payment_expires_at IS NOT NULL)
    AND payment_provider IS DISTINCT FROM 'payos'

  UNION ALL
  SELECT 'legacy_artifact_missing_profile_snapshot', COUNT(*)::bigint
  FROM (
    SELECT payment_profile_code, payos_order_code, payment_link_id, payment_checkout_url, payment_qr_code, payment_created_at, payment_expires_at
    FROM orders WHERE checkout_group_id IS NULL AND payment_provider = 'payos'
    UNION ALL
    SELECT payment_profile_code, payos_order_code, payment_link_id, payment_checkout_url, payment_qr_code, payment_created_at, payment_expires_at
    FROM checkout_groups WHERE payment_provider = 'payos'
  ) legacy
  WHERE (payos_order_code IS NOT NULL OR payment_link_id IS NOT NULL OR payment_checkout_url IS NOT NULL
    OR payment_qr_code IS NOT NULL OR payment_created_at IS NOT NULL OR payment_expires_at IS NOT NULL)
    AND (NULLIF(BTRIM(payment_profile_code), '') IS NULL
      OR NOT EXISTS (SELECT 1 FROM payment_profiles pp WHERE pp.code = legacy.payment_profile_code))

  UNION ALL
  SELECT 'legacy_artifact_ambiguous_shape_or_status', COUNT(*)::bigint
  FROM (
    SELECT payment_status, payos_order_code, payment_link_id, payment_checkout_url, payment_qr_code, payment_created_at, payment_expires_at, paid_at
    FROM orders WHERE checkout_group_id IS NULL AND payment_provider = 'payos'
    UNION ALL
    SELECT payment_status, payos_order_code, payment_link_id, payment_checkout_url, payment_qr_code, payment_created_at, payment_expires_at, paid_at
    FROM checkout_groups WHERE payment_provider = 'payos'
  ) legacy
  WHERE (payos_order_code IS NOT NULL OR payment_link_id IS NOT NULL OR payment_checkout_url IS NOT NULL
    OR payment_qr_code IS NOT NULL OR payment_created_at IS NOT NULL OR payment_expires_at IS NOT NULL)
    AND (payos_order_code IS NULL OR payment_created_at IS NULL OR payment_expires_at IS NULL
      OR (payment_link_id IS NULL AND (payment_checkout_url IS NOT NULL OR payment_qr_code IS NOT NULL))
      OR (payment_link_id IS NOT NULL AND payment_checkout_url IS NULL AND payment_qr_code IS NULL)
      OR (payment_status IN ('paid', 'expired') AND payment_link_id IS NULL)
      OR (payment_status = 'paid' AND paid_at IS NULL))

  UNION ALL
  SELECT 'checkout_group_legacy_invalid_payment_status', COUNT(*)::bigint
  FROM checkout_groups cg
  WHERE cg.payment_provider = 'payos'
    AND (cg.payos_order_code IS NOT NULL OR cg.payment_link_id IS NOT NULL
      OR cg.payment_checkout_url IS NOT NULL OR cg.payment_qr_code IS NOT NULL
      OR cg.payment_created_at IS NOT NULL OR cg.payment_expires_at IS NOT NULL)
    AND cg.payment_status NOT IN ('unpaid', 'paid', 'expired')

  UNION ALL
  SELECT 'duplicate_legacy_provider_order_identity', COUNT(*)::bigint
  FROM (
    SELECT 'payos'::varchar AS provider, payment_profile_code, payos_order_code FROM orders
    WHERE checkout_group_id IS NULL AND payment_provider = 'payos' AND payos_order_code IS NOT NULL
    UNION ALL
    SELECT payment_provider, payment_profile_code, payos_order_code FROM checkout_groups
    WHERE payment_provider = 'payos' AND payos_order_code IS NOT NULL
  ) legacy
  GROUP BY provider, payment_profile_code, payos_order_code HAVING COUNT(*) > 1

  UNION ALL
  SELECT 'duplicate_legacy_provider_link_identity', COUNT(*)::bigint
  FROM (
    SELECT 'payos'::varchar AS provider, payment_profile_code, payment_link_id FROM orders
    WHERE checkout_group_id IS NULL AND payment_provider = 'payos' AND payment_link_id IS NOT NULL
    UNION ALL
    SELECT payment_provider, payment_profile_code, payment_link_id FROM checkout_groups
    WHERE payment_provider = 'payos' AND payment_link_id IS NOT NULL
  ) legacy
  GROUP BY provider, payment_profile_code, payment_link_id HAVING COUNT(*) > 1
)
SELECT check_name, issue_count, CASE WHEN issue_count = 0 THEN 'PASS' ELSE 'BLOCK' END AS status
FROM checks
ORDER BY check_name;

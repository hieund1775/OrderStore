-- Read-only verification for 0026_payment_attempts_additive.sql.
-- Run after 0026 has been applied. This file contains SELECT/CTE only.

WITH legacy_sources AS (
  SELECT
    'order'::VARCHAR AS target_type,
    o.id AS target_id,
    o.payment_profile_code,
    o.payos_order_code,
    o.payment_link_id,
    o.payment_status AS legacy_payment_status,
    o.current_payment_attempt_id
  FROM orders o
  WHERE o.checkout_group_id IS NULL
    AND o.payment_provider = 'payos'
    AND o.payos_order_code IS NOT NULL

  UNION ALL

  SELECT
    'checkout_group'::VARCHAR AS target_type,
    cg.id AS target_id,
    cg.payment_profile_code,
    cg.payos_order_code,
    cg.payment_link_id,
    cg.payment_status AS legacy_payment_status,
    cg.current_payment_attempt_id
  FROM checkout_groups cg
  WHERE cg.payment_provider = 'payos'
    AND cg.payos_order_code IS NOT NULL
), mapped_attempts AS (
  SELECT
    ls.*,
    pa.id AS payment_attempt_id,
    pa.status AS attempt_status,
    pa.payment_profile_code AS attempt_profile_code,
    pa.amount AS attempt_amount
  FROM legacy_sources ls
  LEFT JOIN payment_attempts pa
    ON pa.id = ls.current_payment_attempt_id
)
SELECT
  target_type,
  COUNT(*) AS legacy_artifact_targets,
  COUNT(payment_attempt_id) AS current_attempts_found,
  COUNT(*) FILTER (WHERE payment_attempt_id IS NULL) AS missing_current_attempts,
  COUNT(*) FILTER (WHERE payment_profile_code IS DISTINCT FROM attempt_profile_code) AS profile_snapshot_mismatches,
  COUNT(*) FILTER (WHERE legacy_payment_status = 'paid' AND attempt_status <> 'paid') AS paid_status_mismatches,
  COUNT(*) FILTER (WHERE legacy_payment_status = 'expired' AND attempt_status <> 'expired') AS expired_status_mismatches
FROM mapped_attempts
GROUP BY target_type
ORDER BY target_type;

SELECT
  provider,
  payment_profile_code,
  status,
  COUNT(*) AS attempt_count,
  COUNT(*) FILTER (WHERE order_id IS NOT NULL) AS direct_order_attempts,
  COUNT(*) FILTER (WHERE checkout_group_id IS NOT NULL) AS grouped_attempts
FROM payment_attempts
GROUP BY provider, payment_profile_code, status
ORDER BY provider, payment_profile_code, status;

SELECT
  provider,
  payment_profile_code,
  provider_order_code,
  COUNT(*) AS same_profile_order_code_count
FROM payment_attempts
WHERE provider_order_code IS NOT NULL
GROUP BY provider, payment_profile_code, provider_order_code
HAVING COUNT(*) > 1;

SELECT
  provider,
  payment_profile_code,
  provider_payment_link_id,
  COUNT(*) AS same_profile_link_id_count
FROM payment_attempts
WHERE provider_payment_link_id IS NOT NULL
GROUP BY provider, payment_profile_code, provider_payment_link_id
HAVING COUNT(*) > 1;

-- P1 / 0026 canonical legacy blocker classification. Raw payment identifiers
-- are returned only to guarded audit CLIs and are never logged by those CLIs.
-- This is the sole source for legacy aggregate, provider, and history audits.
WITH latest_order_lifecycle AS (
  SELECT DISTINCT ON (osh.order_id) osh.order_id, osh.status AS lifecycle_status
  FROM order_status_history osh
  ORDER BY osh.order_id, osh.created_at DESC, osh.id DESC
),
legacy_targets AS (
  SELECT
    'direct_order'::text AS target_kind, o.id AS target_id, o.payment_status,
    lol.lifecycle_status, o.payment_profile_code, o.payment_profile_id,
    o.receiver_bank_name, o.receiver_account_number, o.receiver_account_holder,
    o.payos_order_code AS provider_order_code, o.total::numeric AS expected_amount,
    o.payment_link_id AS expected_payment_link_id, o.transaction_id,
    o.payos_order_code IS NOT NULL AS has_payos_order_code,
    o.payment_link_id IS NOT NULL AS has_payment_link_id,
    o.payment_checkout_url IS NOT NULL AS has_checkout_url,
    o.payment_qr_code IS NOT NULL AS has_qr_code,
    o.payment_created_at IS NOT NULL AS has_payment_created_at,
    o.payment_expires_at IS NOT NULL AS has_expires_at,
    o.paid_at IS NOT NULL AS has_paid_at
  FROM orders o
  LEFT JOIN latest_order_lifecycle lol ON lol.order_id = o.id
  WHERE o.checkout_group_id IS NULL AND o.payment_provider = 'payos'
    AND (o.payos_order_code IS NOT NULL OR o.payment_link_id IS NOT NULL
      OR o.payment_checkout_url IS NOT NULL OR o.payment_qr_code IS NOT NULL
      OR o.payment_created_at IS NOT NULL OR o.payment_expires_at IS NOT NULL)

  UNION ALL

  SELECT
    'checkout_group'::text, cg.id, cg.payment_status, NULL::varchar,
    cg.payment_profile_code, cg.payment_profile_id,
    cg.receiver_bank_name, cg.receiver_account_number, cg.receiver_account_holder,
    cg.payos_order_code, cg.total_amount::numeric, cg.payment_link_id, NULL::varchar,
    cg.payos_order_code IS NOT NULL, cg.payment_link_id IS NOT NULL,
    cg.payment_checkout_url IS NOT NULL, cg.payment_qr_code IS NOT NULL,
    cg.payment_created_at IS NOT NULL, cg.payment_expires_at IS NOT NULL,
    cg.paid_at IS NOT NULL
  FROM checkout_groups cg
  WHERE cg.payment_provider = 'payos'
    AND (cg.payos_order_code IS NOT NULL OR cg.payment_link_id IS NOT NULL
      OR cg.payment_checkout_url IS NOT NULL OR cg.payment_qr_code IS NOT NULL
      OR cg.payment_created_at IS NOT NULL OR cg.payment_expires_at IS NOT NULL)
),
profile_candidates AS (
  SELECT lt.target_kind, lt.target_id, pp.code AS profile_code, 'stored_profile_code'::text AS source
  FROM legacy_targets lt JOIN payment_profiles pp ON pp.code = NULLIF(BTRIM(lt.payment_profile_code), '')
  UNION
  SELECT lt.target_kind, lt.target_id, pp.code, 'payment_profile_id'::text
  FROM legacy_targets lt JOIN payment_profiles pp ON pp.id = lt.payment_profile_id
  UNION
  SELECT lt.target_kind, lt.target_id, pp.code, 'receiver_snapshot'::text
  FROM legacy_targets lt
  JOIN payment_profiles pp
    ON lt.receiver_bank_name IS NOT NULL AND lt.receiver_account_number IS NOT NULL AND lt.receiver_account_holder IS NOT NULL
   AND pp.bank_name = lt.receiver_bank_name AND pp.account_number = lt.receiver_account_number AND pp.account_holder = lt.receiver_account_holder
),
profile_evidence AS (
  SELECT
    lt.target_kind, lt.target_id, COUNT(DISTINCT pc.profile_code)::int AS resolved_profile_count,
    COALESCE(BOOL_OR(pc.source = 'stored_profile_code'), FALSE) AS has_stored_profile_code_evidence,
    COALESCE(BOOL_OR(pc.source = 'payment_profile_id'), FALSE) AS has_profile_id_evidence,
    COALESCE(BOOL_OR(pc.source = 'receiver_snapshot'), FALSE) AS has_receiver_snapshot_evidence
  FROM legacy_targets lt
  LEFT JOIN profile_candidates pc ON pc.target_kind = lt.target_kind AND pc.target_id = lt.target_id
  GROUP BY lt.target_kind, lt.target_id
),
classified AS (
  SELECT
    lt.*, pe.resolved_profile_count, pe.has_stored_profile_code_evidence,
    pe.has_profile_id_evidence, pe.has_receiver_snapshot_evidence,
    (NULLIF(BTRIM(lt.payment_profile_code), '') IS NULL
      OR NOT EXISTS (SELECT 1 FROM payment_profiles pp WHERE pp.code = lt.payment_profile_code)) AS missing_profile_snapshot,
    (NOT lt.has_payos_order_code OR NOT lt.has_payment_created_at OR NOT lt.has_expires_at
      OR (NOT lt.has_payment_link_id AND (lt.has_checkout_url OR lt.has_qr_code))
      OR (lt.has_payment_link_id AND NOT lt.has_checkout_url AND NOT lt.has_qr_code)
      OR (lt.payment_status IN ('paid', 'expired') AND NOT lt.has_payment_link_id)
      OR (lt.payment_status = 'paid' AND NOT lt.has_paid_at)) AS ambiguous_shape_or_status,
    ((lt.target_kind = 'direct_order' AND (lt.payment_status IN ('paid', 'cancelled') OR lt.lifecycle_status IN ('Hoàn thành', 'Đã hủy')))
      OR (lt.target_kind = 'checkout_group' AND lt.payment_status IN ('paid', 'cancelled'))) AS clearly_terminal,
    (lt.payment_status IN ('unpaid', 'expired') AND COALESCE(lt.lifecycle_status, '') <> 'Đã hủy'
      AND (lt.has_payos_order_code OR lt.has_payment_link_id)) AS reconciliation_needed
  FROM legacy_targets lt JOIN profile_evidence pe ON pe.target_kind = lt.target_kind AND pe.target_id = lt.target_id
),
blocked AS (
  SELECT
    *,
    CASE
      WHEN reconciliation_needed THEN 'ACTIVE_PAYMENT_REQUIRES_REPAIR'
      WHEN clearly_terminal AND NOT reconciliation_needed THEN 'SAFE_TO_SKIP_HISTORY'
      WHEN missing_profile_snapshot AND NOT ambiguous_shape_or_status AND resolved_profile_count = 1 THEN 'DETERMINISTICALLY_REPAIRABLE'
      ELSE 'AMBIGUOUS_BLOCK'
    END AS classification,
    CASE
      WHEN resolved_profile_count <> 1 THEN 'NONE_OR_MULTIPLE_PROFILES'
      WHEN has_profile_id_evidence AND has_receiver_snapshot_evidence THEN 'PROFILE_ID_AND_RECEIVER_SNAPSHOT'
      WHEN has_profile_id_evidence THEN 'PAYMENT_PROFILE_ID'
      WHEN has_receiver_snapshot_evidence THEN 'RECEIVER_SNAPSHOT_UNIQUE'
      WHEN has_stored_profile_code_evidence THEN 'STORED_PROFILE_CODE'
      ELSE 'NONE_OR_MULTIPLE_PROFILES'
    END AS deterministic_evidence_source
  FROM classified
  WHERE missing_profile_snapshot OR ambiguous_shape_or_status
)
SELECT
  target_kind, target_id, payment_status, lifecycle_status, provider_order_code,
  expected_amount, expected_payment_link_id, transaction_id,
  has_payos_order_code, has_payment_link_id, has_checkout_url, has_qr_code,
  has_payment_created_at, has_expires_at, has_paid_at,
  missing_profile_snapshot, ambiguous_shape_or_status, resolved_profile_count,
  deterministic_evidence_source, reconciliation_needed, classification
FROM blocked
ORDER BY target_kind, target_id;

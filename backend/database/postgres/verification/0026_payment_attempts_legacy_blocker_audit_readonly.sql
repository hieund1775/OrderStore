-- P1 / 0026 legacy blocker audit. This query is intentionally aggregate-only:
-- it never returns target IDs, customer fields, payment URLs, QR payloads,
-- bank values, or credential material. It does not use category mappings.
WITH latest_order_lifecycle AS (
  SELECT DISTINCT ON (osh.order_id)
    osh.order_id,
    osh.status AS lifecycle_status
  FROM order_status_history osh
  ORDER BY osh.order_id, osh.created_at DESC, osh.id DESC
),
legacy_targets AS (
  SELECT
    'direct_order'::text AS target_kind,
    o.id AS target_id,
    o.payment_status,
    lol.lifecycle_status,
    o.payment_profile_code,
    o.payment_profile_id,
    o.receiver_bank_name,
    o.receiver_account_number,
    o.receiver_account_holder,
    o.payos_order_code IS NOT NULL AS has_payos_order_code,
    o.payment_link_id IS NOT NULL AS has_payment_link_id,
    o.payment_checkout_url IS NOT NULL AS has_checkout_url,
    o.payment_qr_code IS NOT NULL AS has_qr_code,
    o.payment_created_at IS NOT NULL AS has_payment_created_at,
    o.payment_expires_at IS NOT NULL AS has_expires_at,
    o.paid_at IS NOT NULL AS has_paid_at
  FROM orders o
  LEFT JOIN latest_order_lifecycle lol ON lol.order_id = o.id
  WHERE o.checkout_group_id IS NULL
    AND o.payment_provider = 'payos'
    AND (
      o.payos_order_code IS NOT NULL OR o.payment_link_id IS NOT NULL
      OR o.payment_checkout_url IS NOT NULL OR o.payment_qr_code IS NOT NULL
      OR o.payment_created_at IS NOT NULL OR o.payment_expires_at IS NOT NULL
    )

  UNION ALL

  SELECT
    'checkout_group'::text AS target_kind,
    cg.id AS target_id,
    cg.payment_status,
    NULL::varchar AS lifecycle_status,
    cg.payment_profile_code,
    cg.payment_profile_id,
    cg.receiver_bank_name,
    cg.receiver_account_number,
    cg.receiver_account_holder,
    cg.payos_order_code IS NOT NULL AS has_payos_order_code,
    cg.payment_link_id IS NOT NULL AS has_payment_link_id,
    cg.payment_checkout_url IS NOT NULL AS has_checkout_url,
    cg.payment_qr_code IS NOT NULL AS has_qr_code,
    cg.payment_created_at IS NOT NULL AS has_payment_created_at,
    cg.payment_expires_at IS NOT NULL AS has_expires_at,
    cg.paid_at IS NOT NULL AS has_paid_at
  FROM checkout_groups cg
  WHERE cg.payment_provider = 'payos'
    AND (
      cg.payos_order_code IS NOT NULL OR cg.payment_link_id IS NOT NULL
      OR cg.payment_checkout_url IS NOT NULL OR cg.payment_qr_code IS NOT NULL
      OR cg.payment_created_at IS NOT NULL OR cg.payment_expires_at IS NOT NULL
    )
),
profile_candidates AS (
  -- A valid stored profile code is itself historical evidence.
  SELECT lt.target_kind, lt.target_id, pp.code AS profile_code, 'stored_profile_code'::text AS source
  FROM legacy_targets lt
  JOIN payment_profiles pp ON pp.code = NULLIF(BTRIM(lt.payment_profile_code), '')

  UNION

  -- payment_profile_id is a historical FK snapshot; inactive profiles still count.
  SELECT lt.target_kind, lt.target_id, pp.code AS profile_code, 'payment_profile_id'::text AS source
  FROM legacy_targets lt
  JOIN payment_profiles pp ON pp.id = lt.payment_profile_id

  UNION

  -- Only a complete receiver snapshot may be matched. Values are never emitted.
  SELECT lt.target_kind, lt.target_id, pp.code AS profile_code, 'receiver_snapshot'::text AS source
  FROM legacy_targets lt
  JOIN payment_profiles pp
    ON lt.receiver_bank_name IS NOT NULL
   AND lt.receiver_account_number IS NOT NULL
   AND lt.receiver_account_holder IS NOT NULL
   AND pp.bank_name = lt.receiver_bank_name
   AND pp.account_number = lt.receiver_account_number
   AND pp.account_holder = lt.receiver_account_holder
),
profile_evidence AS (
  SELECT
    lt.target_kind,
    lt.target_id,
    COUNT(DISTINCT pc.profile_code)::int AS resolved_profile_count,
    BOOL_OR(pc.source = 'stored_profile_code') AS has_stored_profile_code_evidence,
    BOOL_OR(pc.source = 'payment_profile_id') AS has_profile_id_evidence,
    BOOL_OR(pc.source = 'receiver_snapshot') AS has_receiver_snapshot_evidence
  FROM legacy_targets lt
  LEFT JOIN profile_candidates pc
    ON pc.target_kind = lt.target_kind AND pc.target_id = lt.target_id
  GROUP BY lt.target_kind, lt.target_id
),
classified AS (
  SELECT
    lt.*,
    pe.resolved_profile_count,
    COALESCE(pe.has_stored_profile_code_evidence, FALSE) AS has_stored_profile_code_evidence,
    COALESCE(pe.has_profile_id_evidence, FALSE) AS has_profile_id_evidence,
    COALESCE(pe.has_receiver_snapshot_evidence, FALSE) AS has_receiver_snapshot_evidence,
    (
      NULLIF(BTRIM(lt.payment_profile_code), '') IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM payment_profiles pp
        WHERE pp.code = lt.payment_profile_code
      )
    ) AS missing_profile_snapshot,
    (
      NOT lt.has_payos_order_code
      OR NOT lt.has_payment_created_at
      OR NOT lt.has_expires_at
      OR (NOT lt.has_payment_link_id AND (lt.has_checkout_url OR lt.has_qr_code))
      OR (lt.has_payment_link_id AND NOT lt.has_checkout_url AND NOT lt.has_qr_code)
      OR (lt.payment_status IN ('paid', 'expired') AND NOT lt.has_payment_link_id)
      OR (lt.payment_status = 'paid' AND NOT lt.has_paid_at)
    ) AS ambiguous_shape_or_status,
    (
      (lt.target_kind = 'direct_order' AND (lt.payment_status IN ('paid', 'cancelled') OR lt.lifecycle_status IN ('Hoàn thành', 'Đã hủy')))
      OR (lt.target_kind = 'checkout_group' AND lt.payment_status IN ('paid', 'cancelled'))
    ) AS clearly_terminal,
    (
      lt.payment_status IN ('unpaid', 'expired')
      AND COALESCE(lt.lifecycle_status, '') <> 'Đã hủy'
      AND (lt.has_payos_order_code OR lt.has_payment_link_id)
    ) AS reconciliation_needed
  FROM legacy_targets lt
  JOIN profile_evidence pe
    ON pe.target_kind = lt.target_kind AND pe.target_id = lt.target_id
),
blocked AS (
  SELECT
    *,
    CASE
      WHEN reconciliation_needed THEN 'ACTIVE_PAYMENT_REQUIRES_REPAIR'
      WHEN clearly_terminal AND NOT reconciliation_needed THEN 'SAFE_TO_SKIP_HISTORY'
      WHEN missing_profile_snapshot
        AND NOT ambiguous_shape_or_status
        AND resolved_profile_count = 1 THEN 'DETERMINISTICALLY_REPAIRABLE'
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
),
summary AS (
  SELECT
    COUNT(*)::bigint AS unique_blocked_targets,
    COUNT(*) FILTER (WHERE ambiguous_shape_or_status AND NOT missing_profile_snapshot)::bigint AS ambiguous_only,
    COUNT(*) FILTER (WHERE missing_profile_snapshot AND NOT ambiguous_shape_or_status)::bigint AS missing_profile_only,
    COUNT(*) FILTER (WHERE missing_profile_snapshot AND ambiguous_shape_or_status)::bigint AS overlap,
    COUNT(*) FILTER (WHERE reconciliation_needed)::bigint AS reconciliation_needed_count
  FROM blocked
),
breakdown AS (
  SELECT
    target_kind,
    payment_status,
    COALESCE(lifecycle_status, 'NOT_APPLICABLE') AS lifecycle_status,
    has_payos_order_code,
    has_payment_link_id,
    has_checkout_url,
    has_qr_code,
    has_payment_created_at,
    has_expires_at,
    has_paid_at,
    missing_profile_snapshot,
    ambiguous_shape_or_status,
    resolved_profile_count,
    deterministic_evidence_source,
    reconciliation_needed,
    classification,
    COUNT(*)::bigint AS target_count
  FROM blocked
  GROUP BY
    target_kind, payment_status, COALESCE(lifecycle_status, 'NOT_APPLICABLE'),
    has_payos_order_code, has_payment_link_id, has_checkout_url, has_qr_code,
    has_payment_created_at, has_expires_at, has_paid_at,
    missing_profile_snapshot, ambiguous_shape_or_status, resolved_profile_count,
    deterministic_evidence_source, reconciliation_needed, classification
),
classification_counts AS (
  SELECT classification, COUNT(*)::bigint AS target_count
  FROM blocked
  GROUP BY classification
),
deterministic_evidence_counts AS (
  SELECT deterministic_evidence_source, COUNT(*)::bigint AS target_count
  FROM blocked
  WHERE classification = 'DETERMINISTICALLY_REPAIRABLE'
  GROUP BY deterministic_evidence_source
)
SELECT jsonb_build_object(
  'summary', jsonb_build_object(
    'unique_blocked_targets', summary.unique_blocked_targets,
    'ambiguous_only', summary.ambiguous_only,
    'missing_profile_only', summary.missing_profile_only,
    'overlap', summary.overlap,
    'reconciliation_needed_count', summary.reconciliation_needed_count
  ),
  'breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.target_kind, b.payment_status, b.lifecycle_status, b.classification) FROM breakdown b), '[]'::jsonb),
  'classification_counts', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.classification) FROM classification_counts c), '[]'::jsonb),
  'deterministic_evidence_source_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.deterministic_evidence_source) FROM deterministic_evidence_counts d), '[]'::jsonb)
) AS report
FROM summary;

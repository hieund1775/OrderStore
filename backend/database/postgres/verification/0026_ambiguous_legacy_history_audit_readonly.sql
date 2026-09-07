-- P1 / 0026 ambiguous legacy-history audit. Aggregate evidence only: no raw
-- target ID, provider order code, payment link, event key, payload, or PII.
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
    o.payos_order_code AS provider_order_code, o.payment_link_id AS payment_link_id,
    o.transaction_id,
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
    cg.payos_order_code, cg.payment_link_id, NULL::varchar,
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
  SELECT lt.target_kind, lt.target_id, pp.code
  FROM legacy_targets lt JOIN payment_profiles pp ON pp.code = NULLIF(BTRIM(lt.payment_profile_code), '')
  UNION
  SELECT lt.target_kind, lt.target_id, pp.code
  FROM legacy_targets lt JOIN payment_profiles pp ON pp.id = lt.payment_profile_id
  UNION
  SELECT lt.target_kind, lt.target_id, pp.code
  FROM legacy_targets lt
  JOIN payment_profiles pp
    ON lt.receiver_bank_name IS NOT NULL AND lt.receiver_account_number IS NOT NULL AND lt.receiver_account_holder IS NOT NULL
   AND pp.bank_name = lt.receiver_bank_name AND pp.account_number = lt.receiver_account_number AND pp.account_holder = lt.receiver_account_holder
),
profile_evidence AS (
  SELECT lt.target_kind, lt.target_id, COUNT(DISTINCT pc.code)::int AS resolved_profile_count
  FROM legacy_targets lt
  LEFT JOIN profile_candidates pc ON pc.target_kind = lt.target_kind AND pc.target_id = lt.target_id
  GROUP BY lt.target_kind, lt.target_id
),
ambiguous_targets AS (
  SELECT lt.*
  FROM legacy_targets lt
  JOIN profile_evidence pe ON pe.target_kind = lt.target_kind AND pe.target_id = lt.target_id
  WHERE (
    (
      NULLIF(BTRIM(lt.payment_profile_code), '') IS NULL
      OR NOT EXISTS (SELECT 1 FROM payment_profiles pp WHERE pp.code = lt.payment_profile_code)
    )
    OR (
      NOT lt.has_payos_order_code OR NOT lt.has_payment_created_at OR NOT lt.has_expires_at
      OR (NOT lt.has_payment_link_id AND (lt.has_checkout_url OR lt.has_qr_code))
      OR (lt.has_payment_link_id AND NOT lt.has_checkout_url AND NOT lt.has_qr_code)
      OR (lt.payment_status IN ('paid', 'expired') AND NOT lt.has_payment_link_id)
      OR (lt.payment_status = 'paid' AND NOT lt.has_paid_at)
    )
    )
    AND NOT (
      (lt.target_kind = 'direct_order' AND (lt.payment_status IN ('paid', 'cancelled') OR lt.lifecycle_status IN ('Hoàn thành', 'Đã hủy')))
      OR (lt.target_kind = 'checkout_group' AND lt.payment_status IN ('paid', 'cancelled'))
    )
    AND NOT (
      lt.payment_status IN ('unpaid', 'expired') AND COALESCE(lt.lifecycle_status, '') <> 'Đã hủy'
      AND (lt.has_payos_order_code OR lt.has_payment_link_id)
    )
    AND NOT (
      (
        NULLIF(BTRIM(lt.payment_profile_code), '') IS NULL
        OR NOT EXISTS (SELECT 1 FROM payment_profiles pp WHERE pp.code = lt.payment_profile_code)
      )
      AND NOT (
        NOT lt.has_payos_order_code OR NOT lt.has_payment_created_at OR NOT lt.has_expires_at
        OR (NOT lt.has_payment_link_id AND (lt.has_checkout_url OR lt.has_qr_code))
        OR (lt.has_payment_link_id AND NOT lt.has_checkout_url AND NOT lt.has_qr_code)
        OR (lt.payment_status IN ('paid', 'expired') AND NOT lt.has_payment_link_id)
        OR (lt.payment_status = 'paid' AND NOT lt.has_paid_at)
      )
      AND pe.resolved_profile_count = 1
    )
),
history_flags AS (
  SELECT
    at.target_kind,
    at.target_id,
    BOOL_OR(e.id IS NOT NULL) AS has_any_payment_event,
    BOOL_OR(at.target_kind = 'direct_order' AND e.order_id = at.target_id) AS has_direct_order_event_link,
    BOOL_OR(
      (at.provider_order_code IS NOT NULL AND (
        e.payload ->> 'orderCode' = at.provider_order_code::text
        OR e.payload #>> '{data,orderCode}' = at.provider_order_code::text
      ))
      OR (at.payment_link_id IS NOT NULL AND (
        e.payload ->> 'paymentLinkId' = at.payment_link_id
        OR e.payload #>> '{data,paymentLinkId}' = at.payment_link_id
      ))
    ) AS has_payload_provider_identity_match,
    BOOL_OR(at.transaction_id IS NOT NULL AND (
      e.payload ->> 'reference' = at.transaction_id
      OR e.payload #>> '{data,reference}' = at.transaction_id
    )) AS has_payload_transaction_reference_match,
    BOOL_OR(at.provider_order_code IS NOT NULL AND POSITION(at.provider_order_code::text IN COALESCE(e.provider_event_key, '')) > 0) AS has_weak_event_key_match,
    BOOL_OR(e.processing_status = 'processed') AS has_processed_event,
    BOOL_OR(e.processing_status IN ('pending', 'failed')) AS has_pending_or_failed_event,
    BOOL_OR(e.processing_status = 'ignored') AS has_ignored_event
  FROM ambiguous_targets at
  LEFT JOIN payment_events e
    ON e.provider = 'payos'
   AND (
     (at.target_kind = 'direct_order' AND e.order_id = at.target_id)
     OR (at.provider_order_code IS NOT NULL AND (
       e.payload ->> 'orderCode' = at.provider_order_code::text
       OR e.payload #>> '{data,orderCode}' = at.provider_order_code::text
     ))
     OR (at.payment_link_id IS NOT NULL AND (
       e.payload ->> 'paymentLinkId' = at.payment_link_id
       OR e.payload #>> '{data,paymentLinkId}' = at.payment_link_id
     ))
     OR (at.transaction_id IS NOT NULL AND (
       e.payload ->> 'reference' = at.transaction_id
       OR e.payload #>> '{data,reference}' = at.transaction_id
     ))
     OR (at.provider_order_code IS NOT NULL AND POSITION(at.provider_order_code::text IN COALESCE(e.provider_event_key, '')) > 0)
   )
  GROUP BY at.target_kind, at.target_id
),
evidence AS (
  SELECT
    *,
    CASE
      WHEN NOT has_any_payment_event THEN 'NO_HISTORICAL_EVIDENCE'
      WHEN (has_payload_provider_identity_match::int + has_payload_transaction_reference_match::int + has_direct_order_event_link::int + has_weak_event_key_match::int) > 1 THEN 'MULTIPLE_EVIDENCE_TYPES'
      WHEN has_payload_provider_identity_match OR has_payload_transaction_reference_match THEN 'MATCHED_PROVIDER_IDENTITY_EVIDENCE'
      WHEN has_direct_order_event_link THEN 'DIRECT_ORDER_EVENT_LINK_ONLY'
      WHEN has_weak_event_key_match THEN 'WEAK_EVENT_KEY_ONLY'
      ELSE 'EVENT_WITHOUT_MATCHING_IDENTITY'
    END AS evidence_classification
  FROM history_flags
),
breakdown AS (
  SELECT
    evidence_classification, has_processed_event, has_pending_or_failed_event, has_ignored_event,
    COUNT(*)::bigint AS target_count
  FROM evidence
  GROUP BY evidence_classification, has_processed_event, has_pending_or_failed_event, has_ignored_event
)
SELECT jsonb_build_object(
  'summary', jsonb_build_object(
    'ambiguous_block_targets', (SELECT COUNT(*)::bigint FROM evidence),
    'with_any_payment_event', (SELECT COUNT(*)::bigint FROM evidence WHERE has_any_payment_event),
    'with_matched_provider_identity_evidence', (SELECT COUNT(*)::bigint FROM evidence WHERE has_payload_provider_identity_match OR has_payload_transaction_reference_match),
    'with_direct_order_event_link', (SELECT COUNT(*)::bigint FROM evidence WHERE has_direct_order_event_link),
    'with_weak_event_key_evidence', (SELECT COUNT(*)::bigint FROM evidence WHERE has_weak_event_key_match),
    'without_historical_evidence', (SELECT COUNT(*)::bigint FROM evidence WHERE NOT has_any_payment_event)
  ),
  'breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.evidence_classification, b.has_processed_event, b.has_pending_or_failed_event, b.has_ignored_event) FROM breakdown b), '[]'::jsonb)
) AS report;

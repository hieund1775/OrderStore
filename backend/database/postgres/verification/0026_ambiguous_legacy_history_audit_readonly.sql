-- P1 / 0026 ambiguous legacy-history audit. $1 is an internal JSONB list
-- emitted by the canonical classifier; this query returns aggregate evidence
-- only and never emits target IDs, provider identities, payloads, or PII.
WITH ambiguous_targets AS (
  SELECT *
  FROM jsonb_to_recordset($1::jsonb) AS target(
    target_kind text, target_id bigint, provider_order_code bigint,
    expected_payment_link_id varchar, transaction_id varchar
  )
),
history_flags AS (
  SELECT
    at.target_kind, at.target_id,
    COALESCE(BOOL_OR(e.id IS NOT NULL), FALSE) AS has_any_payment_event,
    COALESCE(BOOL_OR(at.target_kind = 'direct_order' AND e.order_id = at.target_id), FALSE) AS has_direct_order_event_link,
    COALESCE(BOOL_OR((at.provider_order_code IS NOT NULL AND (e.payload ->> 'orderCode' = at.provider_order_code::text OR e.payload #>> '{data,orderCode}' = at.provider_order_code::text)) OR (at.expected_payment_link_id IS NOT NULL AND (e.payload ->> 'paymentLinkId' = at.expected_payment_link_id OR e.payload #>> '{data,paymentLinkId}' = at.expected_payment_link_id))), FALSE) AS has_payload_provider_identity_match,
    COALESCE(BOOL_OR(at.transaction_id IS NOT NULL AND (e.payload ->> 'reference' = at.transaction_id OR e.payload #>> '{data,reference}' = at.transaction_id)), FALSE) AS has_payload_transaction_reference_match,
    COALESCE(BOOL_OR(at.provider_order_code IS NOT NULL AND POSITION(at.provider_order_code::text IN COALESCE(e.provider_event_key, '')) > 0), FALSE) AS has_weak_event_key_match,
    COALESCE(BOOL_OR(e.processing_status = 'processed'), FALSE) AS has_processed_event,
    COALESCE(BOOL_OR(e.processing_status IN ('pending', 'failed')), FALSE) AS has_pending_or_failed_event,
    COALESCE(BOOL_OR(e.processing_status = 'ignored'), FALSE) AS has_ignored_event
  FROM ambiguous_targets at
  LEFT JOIN payment_events e ON e.provider = 'payos' AND (
    (at.target_kind = 'direct_order' AND e.order_id = at.target_id)
    OR (at.provider_order_code IS NOT NULL AND (e.payload ->> 'orderCode' = at.provider_order_code::text OR e.payload #>> '{data,orderCode}' = at.provider_order_code::text))
    OR (at.expected_payment_link_id IS NOT NULL AND (e.payload ->> 'paymentLinkId' = at.expected_payment_link_id OR e.payload #>> '{data,paymentLinkId}' = at.expected_payment_link_id))
    OR (at.transaction_id IS NOT NULL AND (e.payload ->> 'reference' = at.transaction_id OR e.payload #>> '{data,reference}' = at.transaction_id))
    OR (at.provider_order_code IS NOT NULL AND POSITION(at.provider_order_code::text IN COALESCE(e.provider_event_key, '')) > 0)
  )
  GROUP BY at.target_kind, at.target_id
),
evidence AS (
  SELECT *, CASE
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
  SELECT evidence_classification, has_processed_event, has_pending_or_failed_event, has_ignored_event, COUNT(*)::bigint AS target_count
  FROM evidence GROUP BY evidence_classification, has_processed_event, has_pending_or_failed_event, has_ignored_event
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

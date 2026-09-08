-- P1 / 0026 final decision audit for canonical ACTIVE_PAYMENT_REQUIRES_REPAIR.
-- $1 is exactly that internal canonical ACTIVE target list; $2 is its count.
-- The query returns one aggregate JSON report only: no target IDs, provider
-- identities, artifacts, customer fields, payloads, or category mappings.
WITH serialized_input AS (
  SELECT raw.ordinality::bigint AS input_row_id, target.*
  FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS raw(value, ordinality)
  CROSS JOIN LATERAL jsonb_to_record(raw.value) AS target(
    target_kind text,
    target_id bigint,
    provider_order_code bigint,
    expected_payment_link_id varchar,
    transaction_id varchar
  )
),
input_counts AS (
  SELECT COUNT(*)::bigint AS serialized_input_count,
    COUNT(DISTINCT (target_kind, target_id))::bigint AS distinct_input_target_count
  FROM serialized_input
),
latest_order_lifecycle AS (
  SELECT DISTINCT ON (osh.order_id)
    osh.order_id, osh.status AS lifecycle_status, osh.created_at AS lifecycle_changed_at
  FROM order_status_history osh
  ORDER BY osh.order_id, osh.created_at DESC, osh.id DESC
),
target_state AS (
  -- Explicit kind filters prevent the historical UNION ALL fan-out.
  SELECT si.input_row_id, si.target_kind, si.target_id,
    'direct_order'::text AS detail_target_kind,
    o.id IS NOT NULL AS target_exists, o.payment_status, lol.lifecycle_status,
    o.payment_created_at, o.payment_expires_at, o.paid_at,
    o.created_at AS target_created_at, lol.lifecycle_changed_at,
    (o.payos_order_code IS NOT NULL OR o.payment_link_id IS NOT NULL
      OR o.payment_checkout_url IS NOT NULL OR o.payment_qr_code IS NOT NULL) AS has_payos_artifact
  FROM serialized_input si
  LEFT JOIN orders o ON o.id = si.target_id
  LEFT JOIN latest_order_lifecycle lol ON lol.order_id = o.id
  WHERE si.target_kind = 'direct_order'

  UNION ALL

  SELECT si.input_row_id, si.target_kind, si.target_id,
    'checkout_group'::text AS detail_target_kind,
    cg.id IS NOT NULL, cg.payment_status, NULL::varchar,
    cg.payment_created_at, cg.payment_expires_at, cg.paid_at,
    cg.created_at, NULL::timestamptz,
    (cg.payos_order_code IS NOT NULL OR cg.payment_link_id IS NOT NULL
      OR cg.payment_checkout_url IS NOT NULL OR cg.payment_qr_code IS NOT NULL)
  FROM serialized_input si
  LEFT JOIN checkout_groups cg ON cg.id = si.target_id
  WHERE si.target_kind = 'checkout_group'
),
detail_counts AS (
  SELECT COUNT(*)::bigint AS detail_row_count,
    COUNT(*) FILTER (WHERE target_exists)::bigint AS detail_resolved_count,
    COUNT(*) FILTER (WHERE NOT target_exists)::bigint AS unresolved_input_count,
    COUNT(*) FILTER (WHERE detail_target_kind IS DISTINCT FROM target_kind)::bigint AS target_kind_mismatch_count
  FROM target_state
),
input_by_kind AS (
  SELECT target_kind, COUNT(*)::bigint AS serialized_input_count,
    COUNT(DISTINCT (target_kind, target_id))::bigint AS distinct_input_target_count
  FROM serialized_input GROUP BY target_kind
),
detail_by_kind AS (
  SELECT target_kind, COUNT(*)::bigint AS detail_row_count,
    COUNT(*) FILTER (WHERE target_exists)::bigint AS detail_resolved_count,
    COUNT(*) FILTER (WHERE NOT target_exists)::bigint AS unresolved_input_count,
    COUNT(*) FILTER (WHERE detail_target_kind IS DISTINCT FROM target_kind)::bigint AS target_kind_mismatch_count
  FROM target_state GROUP BY target_kind
),
diagnostics_by_kind AS (
  SELECT ibk.target_kind, ibk.serialized_input_count, ibk.distinct_input_target_count,
    (ibk.serialized_input_count - ibk.distinct_input_target_count) AS duplicate_input_count,
    COALESCE(dbk.detail_resolved_count, 0)::bigint AS detail_resolved_count,
    COALESCE(dbk.unresolved_input_count, 0)::bigint AS unresolved_input_count,
    GREATEST(ibk.serialized_input_count - COALESCE(dbk.detail_row_count, 0), 0)::bigint AS missing_from_detail_count,
    GREATEST(COALESCE(dbk.detail_row_count, 0) - ibk.serialized_input_count, 0)::bigint AS unexpected_extra_detail_count,
    COALESCE(dbk.target_kind_mismatch_count, 0)::bigint AS target_kind_mismatch_count
  FROM input_by_kind ibk LEFT JOIN detail_by_kind dbk ON dbk.target_kind = ibk.target_kind
),
with_artifact_time AS (
  SELECT ts.*, CASE
    WHEN payment_created_at IS NOT NULL THEN payment_created_at
    WHEN payment_expires_at IS NOT NULL THEN payment_expires_at
    WHEN target_created_at IS NOT NULL THEN target_created_at
    ELSE NULL
  END AS artifact_timestamp
  FROM target_state ts
),
payment_event_evidence AS (
  SELECT wat.input_row_id,
    COALESCE(BOOL_OR(e.id IS NOT NULL), FALSE) AS has_payment_event,
    COALESCE(BOOL_OR(e.id IS NOT NULL AND wat.payment_expires_at IS NOT NULL
      AND COALESCE(e.processed_at, e.created_at) > wat.payment_expires_at), FALSE) AS has_payment_event_after_expiry,
    COALESCE(BOOL_OR(e.id IS NOT NULL AND e.event_type = 'payment.succeeded'), FALSE) AS has_matched_successful_payment_event,
    COALESCE(BOOL_OR(e.id IS NOT NULL AND e.event_type = 'payment.succeeded'
      AND e.processing_status = 'processed'), FALSE) AS has_processed_paid_event,
    COALESCE(MAX(COALESCE(e.processed_at, e.created_at)), NULL) AS latest_payment_event_at
  FROM with_artifact_time wat
  JOIN serialized_input si ON si.input_row_id = wat.input_row_id
  LEFT JOIN payment_events e ON e.provider = 'payos' AND (
    (wat.target_kind = 'direct_order' AND e.order_id = wat.target_id)
    OR (si.provider_order_code IS NOT NULL AND (e.payload ->> 'orderCode' = si.provider_order_code::text
      OR e.payload #>> '{data,orderCode}' = si.provider_order_code::text))
    OR (si.expected_payment_link_id IS NOT NULL AND (e.payload ->> 'paymentLinkId' = si.expected_payment_link_id
      OR e.payload #>> '{data,paymentLinkId}' = si.expected_payment_link_id))
  )
  GROUP BY wat.input_row_id
),
evidence_state AS (
  SELECT wat.*, pee.has_payment_event, pee.has_payment_event_after_expiry,
    pee.has_matched_successful_payment_event, pee.has_processed_paid_event, pee.latest_payment_event_at,
    (wat.paid_at IS NOT NULL) AS paid_at_present,
    (wat.payment_status = 'paid') AS payment_status_paid,
    pee.has_payment_event AS matched_payment_event,
    (wat.payment_status = 'paid' OR wat.paid_at IS NOT NULL OR pee.has_payment_event) AS has_payment_evidence,
    ((wat.paid_at IS NOT NULL AND wat.artifact_timestamp IS NOT NULL AND wat.paid_at > wat.artifact_timestamp)
      OR (pee.latest_payment_event_at IS NOT NULL AND wat.artifact_timestamp IS NOT NULL AND pee.latest_payment_event_at > wat.artifact_timestamp)
      OR (wat.lifecycle_changed_at IS NOT NULL AND wat.artifact_timestamp IS NOT NULL AND wat.lifecycle_changed_at > wat.artifact_timestamp)) AS has_payment_or_lifecycle_change_after_artifact
  FROM with_artifact_time wat JOIN payment_event_evidence pee ON pee.input_row_id = wat.input_row_id
),
classified AS (
  SELECT es.*,
    CASE
      WHEN artifact_timestamp IS NULL THEN 'UNKNOWN'
      WHEN CURRENT_TIMESTAMP - artifact_timestamp < INTERVAL '24 hours' THEN 'LT_24H'
      WHEN CURRENT_TIMESTAMP - artifact_timestamp <= INTERVAL '7 days' THEN 'D1_TO_D7'
      WHEN CURRENT_TIMESTAMP - artifact_timestamp <= INTERVAL '30 days' THEN 'D8_TO_D30'
      ELSE 'GT_30D'
    END AS artifact_age_bucket,
    CASE WHEN payment_expires_at IS NULL THEN 'EXPIRY_UNKNOWN'
      WHEN payment_expires_at > CURRENT_TIMESTAMP THEN 'STILL_UNEXPIRED' ELSE 'EXPIRED' END AS expiry_state,
    CASE
      WHEN has_payment_evidence THEN 'HAS_PAYMENT_EVIDENCE'
      WHEN artifact_timestamp IS NOT NULL AND (CURRENT_TIMESTAMP - artifact_timestamp <= INTERVAL '30 days'
        OR payment_expires_at > CURRENT_TIMESTAMP OR has_payment_or_lifecycle_change_after_artifact)
        THEN 'RECENT_OR_POTENTIALLY_LIVE'
      WHEN artifact_timestamp IS NOT NULL AND CURRENT_TIMESTAMP - artifact_timestamp > INTERVAL '30 days'
        AND payment_expires_at IS NOT NULL AND payment_expires_at <= CURRENT_TIMESTAMP
        AND payment_status IN ('unpaid', 'expired') AND NOT has_payment_evidence
        AND NOT has_payment_or_lifecycle_change_after_artifact
        THEN 'STALE_LEGACY_SAFE_TO_QUARANTINE'
      ELSE 'UNRESOLVED'
    END AS final_classification
  FROM evidence_state es
),
age_breakdown AS (SELECT artifact_age_bucket, COUNT(*)::bigint AS target_count FROM classified GROUP BY artifact_age_bucket),
payment_status_breakdown AS (SELECT COALESCE(payment_status, 'UNKNOWN') AS payment_status, COUNT(*)::bigint AS target_count FROM classified GROUP BY COALESCE(payment_status, 'UNKNOWN')),
lifecycle_status_breakdown AS (SELECT COALESCE(lifecycle_status, 'NOT_APPLICABLE_OR_UNKNOWN') AS lifecycle_status, COUNT(*)::bigint AS target_count FROM classified GROUP BY COALESCE(lifecycle_status, 'NOT_APPLICABLE_OR_UNKNOWN')),
expiry_breakdown AS (SELECT expiry_state, COUNT(*)::bigint AS target_count FROM classified GROUP BY expiry_state),
artifact_breakdown AS (SELECT has_payos_artifact, COUNT(*)::bigint AS target_count FROM classified GROUP BY has_payos_artifact),
evidence_breakdown AS (SELECT has_payment_event_after_expiry, has_processed_paid_event, has_payment_evidence, COUNT(*)::bigint AS target_count FROM classified GROUP BY has_payment_event_after_expiry, has_processed_paid_event, has_payment_evidence),
change_breakdown AS (SELECT has_payment_or_lifecycle_change_after_artifact, COUNT(*)::bigint AS target_count FROM classified GROUP BY has_payment_or_lifecycle_change_after_artifact),
classification_breakdown AS (SELECT final_classification, COUNT(*)::bigint AS target_count FROM classified GROUP BY final_classification)
,
payment_evidence_targets AS (
  SELECT paid_at_present, payment_status_paid, matched_payment_event,
    has_matched_successful_payment_event, has_processed_paid_event
  FROM classified WHERE final_classification = 'HAS_PAYMENT_EVIDENCE'
),
payment_evidence_overlap AS (
  SELECT paid_at_present, payment_status_paid, matched_payment_event,
    has_matched_successful_payment_event, has_processed_paid_event,
    COUNT(*)::bigint AS target_count
  FROM payment_evidence_targets
  GROUP BY paid_at_present, payment_status_paid, matched_payment_event,
    has_matched_successful_payment_event, has_processed_paid_event
),
recent_live_targets AS (
  SELECT
    (artifact_timestamp IS NOT NULL AND CURRENT_TIMESTAMP - artifact_timestamp <= INTERVAL '30 days') AS artifact_age_lt_30d,
    (payment_expires_at > CURRENT_TIMESTAMP) AS expiry_still_live,
    has_payment_or_lifecycle_change_after_artifact,
    CASE
      WHEN (artifact_timestamp IS NOT NULL AND CURRENT_TIMESTAMP - artifact_timestamp <= INTERVAL '30 days')
        AND NOT (payment_expires_at > CURRENT_TIMESTAMP)
        AND NOT has_payment_or_lifecycle_change_after_artifact THEN 'RECENCY_ONLY'
      WHEN NOT (artifact_timestamp IS NOT NULL AND CURRENT_TIMESTAMP - artifact_timestamp <= INTERVAL '30 days')
        AND has_payment_or_lifecycle_change_after_artifact
        AND NOT (payment_expires_at > CURRENT_TIMESTAMP) THEN 'CHANGE_ONLY'
      WHEN NOT (artifact_timestamp IS NOT NULL AND CURRENT_TIMESTAMP - artifact_timestamp <= INTERVAL '30 days')
        AND NOT has_payment_or_lifecycle_change_after_artifact
        AND (payment_expires_at > CURRENT_TIMESTAMP) THEN 'UNEXPIRED_ONLY'
      ELSE 'MULTIPLE_PREDICATES'
    END AS reason
  FROM classified WHERE final_classification = 'RECENT_OR_POTENTIALLY_LIVE'
),
recent_live_overlap AS (
  SELECT artifact_age_lt_30d, expiry_still_live, has_payment_or_lifecycle_change_after_artifact,
    COUNT(*)::bigint AS target_count
  FROM recent_live_targets
  GROUP BY artifact_age_lt_30d, expiry_still_live, has_payment_or_lifecycle_change_after_artifact
),
recent_live_reason_counts AS (
  SELECT reason, COUNT(*)::bigint AS target_count FROM recent_live_targets GROUP BY reason
),
age_by_final_classification AS (
  SELECT final_classification, artifact_age_bucket, COUNT(*)::bigint AS target_count
  FROM classified
  WHERE final_classification IN ('HAS_PAYMENT_EVIDENCE', 'RECENT_OR_POTENTIALLY_LIVE')
  GROUP BY final_classification, artifact_age_bucket
)
SELECT jsonb_build_object(
  'input_diagnostics', jsonb_build_object(
    'canonical_active_count', $2::bigint,
    'serialized_input_count', ic.serialized_input_count,
    'distinct_input_target_count', ic.distinct_input_target_count,
    'duplicate_input_count', (ic.serialized_input_count - ic.distinct_input_target_count),
    'detail_resolved_count', dc.detail_resolved_count,
    'unresolved_input_count', dc.unresolved_input_count,
    'missing_from_detail_count', GREATEST(ic.serialized_input_count - dc.detail_row_count, 0),
    'unexpected_extra_detail_count', GREATEST(dc.detail_row_count - ic.serialized_input_count, 0),
    'target_kind_mismatch_count', dc.target_kind_mismatch_count,
    'by_target_kind', COALESCE((SELECT jsonb_agg(to_jsonb(dbk) ORDER BY dbk.target_kind) FROM diagnostics_by_kind dbk), '[]'::jsonb)
  ),
  'age_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(ab) ORDER BY ab.artifact_age_bucket) FROM age_breakdown ab), '[]'::jsonb),
  'payment_status_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(pb) ORDER BY pb.payment_status) FROM payment_status_breakdown pb), '[]'::jsonb),
  'lifecycle_status_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(lb) ORDER BY lb.lifecycle_status) FROM lifecycle_status_breakdown lb), '[]'::jsonb),
  'expiry_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(eb) ORDER BY eb.expiry_state) FROM expiry_breakdown eb), '[]'::jsonb),
  'payos_artifact_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(ab) ORDER BY ab.has_payos_artifact) FROM artifact_breakdown ab), '[]'::jsonb),
  'post_expiry_payment_evidence_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(eb) ORDER BY eb.has_payment_event_after_expiry, eb.has_processed_paid_event, eb.has_payment_evidence) FROM evidence_breakdown eb), '[]'::jsonb),
  'payment_or_lifecycle_change_after_artifact_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(cb) ORDER BY cb.has_payment_or_lifecycle_change_after_artifact) FROM change_breakdown cb), '[]'::jsonb),
  'final_classification_counts', COALESCE((SELECT jsonb_agg(to_jsonb(cb) ORDER BY cb.final_classification) FROM classification_breakdown cb), '[]'::jsonb),
  'payment_evidence_explanation', jsonb_build_object(
    'target_count', (SELECT COUNT(*)::bigint FROM payment_evidence_targets),
    'source_counts', jsonb_build_object(
      'paid_at_present', (SELECT COUNT(*)::bigint FROM payment_evidence_targets WHERE paid_at_present),
      'payment_status_paid', (SELECT COUNT(*)::bigint FROM payment_evidence_targets WHERE payment_status_paid),
      'matched_successful_payment_event', (SELECT COUNT(*)::bigint FROM payment_evidence_targets WHERE has_matched_successful_payment_event),
      'processed_paid_event', (SELECT COUNT(*)::bigint FROM payment_evidence_targets WHERE has_processed_paid_event),
      'matched_payment_event', (SELECT COUNT(*)::bigint FROM payment_evidence_targets WHERE matched_payment_event)
    ),
    'overlap', COALESCE((SELECT jsonb_agg(to_jsonb(peo) ORDER BY peo.paid_at_present, peo.payment_status_paid, peo.matched_payment_event, peo.has_matched_successful_payment_event, peo.has_processed_paid_event) FROM payment_evidence_overlap peo), '[]'::jsonb)
  ),
  'recent_live_explanation', jsonb_build_object(
    'target_count', (SELECT COUNT(*)::bigint FROM recent_live_targets),
    'predicate_counts', jsonb_build_object(
      'artifact_age_lt_30d', (SELECT COUNT(*)::bigint FROM recent_live_targets WHERE artifact_age_lt_30d),
      'expiry_still_live', (SELECT COUNT(*)::bigint FROM recent_live_targets WHERE expiry_still_live),
      'payment_or_lifecycle_change_after_artifact', (SELECT COUNT(*)::bigint FROM recent_live_targets WHERE has_payment_or_lifecycle_change_after_artifact)
    ),
    'reason_counts', COALESCE((SELECT jsonb_agg(to_jsonb(rlr) ORDER BY rlr.reason) FROM recent_live_reason_counts rlr), '[]'::jsonb),
    'predicate_overlap', COALESCE((SELECT jsonb_agg(to_jsonb(rlo) ORDER BY rlo.artifact_age_lt_30d, rlo.expiry_still_live, rlo.has_payment_or_lifecycle_change_after_artifact) FROM recent_live_overlap rlo), '[]'::jsonb)
  ),
  'age_by_final_classification', COALESCE((SELECT jsonb_agg(to_jsonb(abfc) ORDER BY abfc.final_classification, abfc.artifact_age_bucket) FROM age_by_final_classification abfc), '[]'::jsonb),
  'remediation_decision', CASE
    WHEN $2::bigint > 0 AND $2::bigint = ic.serialized_input_count
      AND ic.serialized_input_count = ic.distinct_input_target_count
      AND ic.serialized_input_count = dc.detail_resolved_count AND dc.unresolved_input_count = 0
      AND dc.detail_row_count = ic.serialized_input_count AND dc.target_kind_mismatch_count = 0
      AND NOT EXISTS (SELECT 1 FROM classified WHERE final_classification <> 'STALE_LEGACY_SAFE_TO_QUARANTINE')
      THEN 'PROPOSE_ADDITIVE_QUARANTINE_ONLY'
    ELSE 'KEEP_BLOCKED'
  END
) AS report
FROM input_counts ic CROSS JOIN detail_counts dc;

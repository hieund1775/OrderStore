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
      OR o.payment_checkout_url IS NOT NULL OR o.payment_qr_code IS NOT NULL) AS has_payos_artifact,
    o.total::numeric AS target_amount,
    NULLIF(BTRIM(o.payment_profile_code), '') AS historical_profile_code,
    (o.payment_status = 'cancelled' OR lol.lifecycle_status = 'Đã hủy') AS target_cancelled
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
      OR cg.payment_checkout_url IS NOT NULL OR cg.payment_qr_code IS NOT NULL),
    cg.total_amount::numeric,
    NULLIF(BTRIM(cg.payment_profile_code), ''),
    (cg.payment_status = 'cancelled')
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
matched_payment_events AS (
  SELECT wat.input_row_id, e.id, e.event_type, e.processing_status, e.created_at, e.processed_at, e.payload,
    ((wat.target_kind = 'direct_order' AND e.order_id = wat.target_id)) AS direct_target_identity_match,
    (si.provider_order_code IS NOT NULL AND (
      e.payload ->> 'orderCode' = si.provider_order_code::text
      OR e.payload #>> '{data,orderCode}' = si.provider_order_code::text
    )) AS provider_order_identity_match,
    (si.expected_payment_link_id IS NOT NULL AND (
      e.payload ->> 'paymentLinkId' = si.expected_payment_link_id
      OR e.payload #>> '{data,paymentLinkId}' = si.expected_payment_link_id
    )) AS payment_link_identity_match
  FROM with_artifact_time wat
  JOIN serialized_input si ON si.input_row_id = wat.input_row_id
  JOIN payment_events e ON e.provider = 'payos' AND (
    (wat.target_kind = 'direct_order' AND e.order_id = wat.target_id)
    OR (si.provider_order_code IS NOT NULL AND (e.payload ->> 'orderCode' = si.provider_order_code::text
      OR e.payload #>> '{data,orderCode}' = si.provider_order_code::text))
    OR (si.expected_payment_link_id IS NOT NULL AND (e.payload ->> 'paymentLinkId' = si.expected_payment_link_id
      OR e.payload #>> '{data,paymentLinkId}' = si.expected_payment_link_id))
  )
),
payment_event_evidence AS (
  SELECT wat.input_row_id,
    COALESCE(BOOL_OR(mpe.id IS NOT NULL), FALSE) AS has_payment_event,
    COALESCE(BOOL_OR(mpe.id IS NOT NULL AND wat.payment_expires_at IS NOT NULL
      AND COALESCE(mpe.processed_at, mpe.created_at) > wat.payment_expires_at), FALSE) AS has_payment_event_after_expiry,
    COALESCE(BOOL_OR(mpe.id IS NOT NULL AND mpe.event_type = 'payment.succeeded'), FALSE) AS has_matched_successful_payment_event,
    COALESCE(BOOL_OR(mpe.id IS NOT NULL AND mpe.event_type = 'payment.succeeded'
      AND mpe.processing_status = 'processed'), FALSE) AS has_processed_paid_event,
    COALESCE(MAX(COALESCE(mpe.processed_at, mpe.created_at)), NULL) AS latest_payment_event_at
  FROM with_artifact_time wat
  LEFT JOIN matched_payment_events mpe ON mpe.input_row_id = wat.input_row_id
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
),
evidence_event_rows AS (
  SELECT c.input_row_id, c.artifact_timestamp, c.payment_expires_at, c.target_amount,
    c.historical_profile_code, c.target_cancelled,
    mpe.id AS event_id, mpe.event_type, mpe.processing_status, mpe.created_at, mpe.processed_at, mpe.payload,
    mpe.direct_target_identity_match, mpe.provider_order_identity_match, mpe.payment_link_identity_match,
    CASE WHEN mpe.event_type = 'payment.succeeded' THEN 'PAYMENT_SUCCEEDED' ELSE 'OTHER_EVENT_TYPE' END AS event_type_group,
    CASE WHEN mpe.processing_status = 'processed' THEN 'PROCESSED'
      WHEN mpe.processing_status IN ('pending', 'ignored', 'failed') THEN UPPER(mpe.processing_status)
      ELSE 'OTHER_OR_MISSING' END AS processing_status_group,
    CASE WHEN COALESCE(mpe.payload ->> 'code', mpe.payload #>> '{data,code}') = '00' THEN 'CODE_00'
      WHEN NULLIF(BTRIM(COALESCE(mpe.payload ->> 'code', mpe.payload #>> '{data,code}')), '') IS NULL THEN 'MISSING'
      ELSE 'NON_00_OR_OTHER' END AS business_code_state,
    CASE WHEN UPPER(COALESCE(mpe.payload ->> 'status', mpe.payload #>> '{data,status}', '')) = 'PAID' THEN 'PAID'
      WHEN NULLIF(BTRIM(COALESCE(mpe.payload ->> 'status', mpe.payload #>> '{data,status}')), '') IS NULL THEN 'MISSING'
      ELSE 'NOT_PAID_OR_OTHER' END AS provider_status_state,
    CASE WHEN artifact_timestamp IS NULL THEN 'ARTIFACT_TIME_MISSING'
      WHEN COALESCE(mpe.processed_at, mpe.created_at) > artifact_timestamp THEN 'AFTER_ARTIFACT'
      ELSE 'BEFORE_OR_AT_ARTIFACT' END AS artifact_timing_state,
    CASE WHEN payment_expires_at IS NULL THEN 'EXPIRY_TIME_MISSING'
      WHEN COALESCE(mpe.processed_at, mpe.created_at) > payment_expires_at THEN 'AFTER_EXPIRY'
      ELSE 'BEFORE_OR_AT_EXPIRY' END AS expiry_timing_state,
    CASE
      WHEN NULLIF(BTRIM(COALESCE(mpe.payload ->> 'amount', mpe.payload #>> '{data,amount}')), '') !~ '^-?[0-9]+(?:\.[0-9]+)?$' THEN 'MISSING_OR_INVALID'
      WHEN (COALESCE(mpe.payload ->> 'amount', mpe.payload #>> '{data,amount}'))::numeric = target_amount THEN 'MATCH'
      ELSE 'MISMATCH'
    END AS amount_match_state,
    CASE WHEN mpe.direct_target_identity_match AND (mpe.provider_order_identity_match OR mpe.payment_link_identity_match) THEN 'MULTIPLE_MATCHES'
      WHEN mpe.direct_target_identity_match THEN 'DIRECT_TARGET_MATCH'
      WHEN mpe.provider_order_identity_match AND mpe.payment_link_identity_match THEN 'MULTIPLE_MATCHES'
      WHEN mpe.provider_order_identity_match THEN 'PROVIDER_ORDER_MATCH'
      WHEN mpe.payment_link_identity_match THEN 'PAYMENT_LINK_MATCH'
      ELSE 'NO_MATCH' END AS target_identity_match_state
  FROM classified c
  JOIN matched_payment_events mpe ON mpe.input_row_id = c.input_row_id
  WHERE c.final_classification = 'HAS_PAYMENT_EVIDENCE'
),
evidence_target_summary AS (
  SELECT input_row_id,
    CASE WHEN COUNT(DISTINCT event_type_group) = 1 THEN MIN(event_type_group) ELSE 'MULTIPLE_EVENT_TYPE_GROUPS' END AS event_type_group,
    CASE WHEN COUNT(DISTINCT processing_status_group) = 1 THEN MIN(processing_status_group) ELSE 'MULTIPLE_PROCESSING_STATUSES' END AS processing_status_group,
    CASE WHEN COUNT(DISTINCT business_code_state) = 1 THEN MIN(business_code_state) ELSE 'MULTIPLE_BUSINESS_CODE_STATES' END AS business_code_state,
    CASE WHEN COUNT(DISTINCT provider_status_state) = 1 THEN MIN(provider_status_state) ELSE 'MULTIPLE_PROVIDER_STATUS_STATES' END AS provider_status_state,
    CASE WHEN COUNT(DISTINCT artifact_timing_state) = 1 THEN MIN(artifact_timing_state) ELSE 'MULTIPLE_ARTIFACT_TIMINGS' END AS artifact_timing_state,
    CASE WHEN COUNT(DISTINCT expiry_timing_state) = 1 THEN MIN(expiry_timing_state) ELSE 'MULTIPLE_EXPIRY_TIMINGS' END AS expiry_timing_state,
    CASE WHEN COUNT(DISTINCT amount_match_state) = 1 THEN MIN(amount_match_state) ELSE 'MULTIPLE_AMOUNT_STATES' END AS amount_match_state,
    CASE WHEN COUNT(DISTINCT target_identity_match_state) = 1 THEN MIN(target_identity_match_state) ELSE 'MULTIPLE_IDENTITY_MATCH_STATES' END AS target_identity_match_state,
    CASE WHEN BOOL_OR(historical_profile_code IS NULL) THEN 'NOT_DETERMINABLE_NO_PROFILE_SNAPSHOT'
      ELSE 'PROFILE_CODE_RECORDED_NOT_SIGNATURE_VERIFIED' END AS profile_evidence_state,
    CASE
      WHEN BOOL_OR(target_cancelled) THEN 'WOULD_NOT_TRANSITION'
      WHEN BOOL_AND(business_code_state = 'NON_00_OR_OTHER' OR amount_match_state = 'MISMATCH' OR target_identity_match_state = 'NO_MATCH') THEN 'WOULD_NOT_TRANSITION'
      ELSE 'NOT_DETERMINABLE_LEGACY_SNAPSHOT_MISSING'
    END AS p1_transition_interpretation
  FROM evidence_event_rows
  GROUP BY input_row_id
),
evidence_deep_overlap AS (
  SELECT event_type_group, processing_status_group, business_code_state, provider_status_state,
    artifact_timing_state, expiry_timing_state, amount_match_state, target_identity_match_state,
    profile_evidence_state, p1_transition_interpretation, COUNT(*)::bigint AS target_count
  FROM evidence_target_summary
  GROUP BY event_type_group, processing_status_group, business_code_state, provider_status_state,
    artifact_timing_state, expiry_timing_state, amount_match_state, target_identity_match_state,
    profile_evidence_state, p1_transition_interpretation
),
multiple_predicate_change_targets AS (
  SELECT input_row_id,
    (paid_at IS NOT NULL AND artifact_timestamp IS NOT NULL AND paid_at > artifact_timestamp) AS paid_at_after_artifact,
    (latest_payment_event_at IS NOT NULL AND artifact_timestamp IS NOT NULL AND latest_payment_event_at > artifact_timestamp) AS matched_payment_event_after_artifact,
    (lifecycle_changed_at IS NOT NULL AND artifact_timestamp IS NOT NULL AND lifecycle_changed_at > artifact_timestamp) AS lifecycle_change_after_artifact
  FROM classified
  WHERE final_classification = 'RECENT_OR_POTENTIALLY_LIVE'
    AND (COALESCE((artifact_timestamp IS NOT NULL AND CURRENT_TIMESTAMP - artifact_timestamp <= INTERVAL '30 days')::int, 0)
      + COALESCE((payment_expires_at > CURRENT_TIMESTAMP)::int, 0)
      + COALESCE(has_payment_or_lifecycle_change_after_artifact::int, 0)) > 1
),
multiple_predicate_change_overlap AS (
  SELECT paid_at_after_artifact, matched_payment_event_after_artifact, lifecycle_change_after_artifact,
    COUNT(*)::bigint AS target_count
  FROM multiple_predicate_change_targets
  GROUP BY paid_at_after_artifact, matched_payment_event_after_artifact, lifecycle_change_after_artifact
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
  'unresolved_evidence_deep_explanation', jsonb_build_object(
    'has_payment_evidence_target_count', (SELECT COUNT(*)::bigint FROM evidence_target_summary),
    'event_type_group_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('event_type_group', event_type_group, 'target_count', target_count) ORDER BY event_type_group) FROM (SELECT event_type_group, COUNT(*)::bigint AS target_count FROM evidence_target_summary GROUP BY event_type_group) x), '[]'::jsonb),
    'processing_status_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('processing_status', processing_status_group, 'target_count', target_count) ORDER BY processing_status_group) FROM (SELECT processing_status_group, COUNT(*)::bigint AS target_count FROM evidence_target_summary GROUP BY processing_status_group) x), '[]'::jsonb),
    'business_code_state_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('business_code_state', business_code_state, 'target_count', target_count) ORDER BY business_code_state) FROM (SELECT business_code_state, COUNT(*)::bigint AS target_count FROM evidence_target_summary GROUP BY business_code_state) x), '[]'::jsonb),
    'provider_status_state_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('provider_status_state', provider_status_state, 'target_count', target_count) ORDER BY provider_status_state) FROM (SELECT provider_status_state, COUNT(*)::bigint AS target_count FROM evidence_target_summary GROUP BY provider_status_state) x), '[]'::jsonb),
    'artifact_timing_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('artifact_timing_state', artifact_timing_state, 'target_count', target_count) ORDER BY artifact_timing_state) FROM (SELECT artifact_timing_state, COUNT(*)::bigint AS target_count FROM evidence_target_summary GROUP BY artifact_timing_state) x), '[]'::jsonb),
    'expiry_timing_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('expiry_timing_state', expiry_timing_state, 'target_count', target_count) ORDER BY expiry_timing_state) FROM (SELECT expiry_timing_state, COUNT(*)::bigint AS target_count FROM evidence_target_summary GROUP BY expiry_timing_state) x), '[]'::jsonb),
    'amount_match_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('amount_match_state', amount_match_state, 'target_count', target_count) ORDER BY amount_match_state) FROM (SELECT amount_match_state, COUNT(*)::bigint AS target_count FROM evidence_target_summary GROUP BY amount_match_state) x), '[]'::jsonb),
    'target_identity_match_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('target_identity_match_state', target_identity_match_state, 'target_count', target_count) ORDER BY target_identity_match_state) FROM (SELECT target_identity_match_state, COUNT(*)::bigint AS target_count FROM evidence_target_summary GROUP BY target_identity_match_state) x), '[]'::jsonb),
    'profile_evidence_state_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('profile_evidence_state', profile_evidence_state, 'target_count', target_count) ORDER BY profile_evidence_state) FROM (SELECT profile_evidence_state, COUNT(*)::bigint AS target_count FROM evidence_target_summary GROUP BY profile_evidence_state) x), '[]'::jsonb),
    'p1_transition_interpretation_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('p1_transition_interpretation', p1_transition_interpretation, 'target_count', target_count) ORDER BY p1_transition_interpretation) FROM (SELECT p1_transition_interpretation, COUNT(*)::bigint AS target_count FROM evidence_target_summary GROUP BY p1_transition_interpretation) x), '[]'::jsonb),
    'overlap', COALESCE((SELECT jsonb_agg(to_jsonb(edo) ORDER BY edo.event_type_group, edo.processing_status_group, edo.business_code_state, edo.provider_status_state, edo.artifact_timing_state, edo.expiry_timing_state, edo.amount_match_state, edo.target_identity_match_state, edo.profile_evidence_state, edo.p1_transition_interpretation) FROM evidence_deep_overlap edo), '[]'::jsonb)
  ),
  'multiple_predicates_change_explanation', jsonb_build_object(
    'target_count', (SELECT COUNT(*)::bigint FROM multiple_predicate_change_targets),
    'source_counts', jsonb_build_object(
      'paid_at_after_artifact', (SELECT COUNT(*)::bigint FROM multiple_predicate_change_targets WHERE paid_at_after_artifact),
      'matched_payment_event_after_artifact', (SELECT COUNT(*)::bigint FROM multiple_predicate_change_targets WHERE matched_payment_event_after_artifact),
      'lifecycle_change_after_artifact', (SELECT COUNT(*)::bigint FROM multiple_predicate_change_targets WHERE lifecycle_change_after_artifact)
    ),
    'overlap', COALESCE((SELECT jsonb_agg(to_jsonb(mpco) ORDER BY mpco.paid_at_after_artifact, mpco.matched_payment_event_after_artifact, mpco.lifecycle_change_after_artifact) FROM multiple_predicate_change_overlap mpco), '[]'::jsonb)
  ),
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

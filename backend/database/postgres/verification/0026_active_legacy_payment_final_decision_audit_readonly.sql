-- P1 / 0026 final decision audit for canonical ACTIVE_PAYMENT_REQUIRES_REPAIR.
-- $1 is the complete internal canonical-classifier JSON result. This query
-- returns one aggregate JSON report only: no target IDs, provider identities,
-- artifacts, customer fields, payloads, or profile/category mappings.
WITH canonical_input AS (
  SELECT *
  FROM jsonb_to_recordset($1::jsonb) AS target(
    target_kind text,
    target_id bigint,
    provider_order_code bigint,
    expected_payment_link_id varchar,
    transaction_id varchar,
    classification text,
    reconciliation_needed boolean
  )
),
canonical_active AS (
  SELECT *
  FROM canonical_input
  WHERE classification = 'ACTIVE_PAYMENT_REQUIRES_REPAIR'
    AND reconciliation_needed IS TRUE
),
active_distinct AS (
  SELECT DISTINCT ON (target_kind, target_id) *
  FROM canonical_active
  ORDER BY target_kind, target_id
),
latest_order_lifecycle AS (
  SELECT DISTINCT ON (osh.order_id)
    osh.order_id, osh.status AS lifecycle_status, osh.created_at AS lifecycle_changed_at
  FROM order_status_history osh
  ORDER BY osh.order_id, osh.created_at DESC, osh.id DESC
),
target_state AS (
  SELECT
    ad.target_kind,
    ad.target_id,
    o.id IS NOT NULL AS target_exists,
    o.payment_status,
    lol.lifecycle_status,
    o.payment_created_at,
    o.payment_expires_at,
    o.paid_at,
    o.created_at AS target_created_at,
    lol.lifecycle_changed_at,
    (o.payos_order_code IS NOT NULL OR o.payment_link_id IS NOT NULL
      OR o.payment_checkout_url IS NOT NULL OR o.payment_qr_code IS NOT NULL) AS has_payos_artifact
  FROM active_distinct ad
  LEFT JOIN orders o ON ad.target_kind = 'direct_order' AND o.id = ad.target_id
  LEFT JOIN latest_order_lifecycle lol ON lol.order_id = o.id

  UNION ALL

  SELECT
    ad.target_kind,
    ad.target_id,
    cg.id IS NOT NULL,
    cg.payment_status,
    NULL::varchar,
    cg.payment_created_at,
    cg.payment_expires_at,
    cg.paid_at,
    cg.created_at,
    NULL::timestamptz,
    (cg.payos_order_code IS NOT NULL OR cg.payment_link_id IS NOT NULL
      OR cg.payment_checkout_url IS NOT NULL OR cg.payment_qr_code IS NOT NULL)
  FROM active_distinct ad
  LEFT JOIN checkout_groups cg ON ad.target_kind = 'checkout_group' AND cg.id = ad.target_id
),
with_artifact_time AS (
  SELECT
    ts.*,
    CASE
      WHEN payment_created_at IS NOT NULL THEN payment_created_at
      WHEN payment_expires_at IS NOT NULL THEN payment_expires_at
      WHEN target_created_at IS NOT NULL THEN target_created_at
      ELSE NULL
    END AS artifact_timestamp
  FROM target_state ts
),
payment_event_evidence AS (
  SELECT
    wat.target_kind,
    wat.target_id,
    COALESCE(BOOL_OR(e.id IS NOT NULL), FALSE) AS has_payment_event,
    COALESCE(BOOL_OR(
      e.id IS NOT NULL
      AND wat.payment_expires_at IS NOT NULL
      AND COALESCE(e.processed_at, e.created_at) > wat.payment_expires_at
    ), FALSE) AS has_payment_event_after_expiry,
    COALESCE(BOOL_OR(
      e.id IS NOT NULL
      AND e.event_type = 'payment.succeeded'
      AND e.processing_status = 'processed'
    ), FALSE) AS has_processed_paid_event,
    COALESCE(MAX(COALESCE(e.processed_at, e.created_at)), NULL) AS latest_payment_event_at
  FROM with_artifact_time wat
  JOIN active_distinct ad ON ad.target_kind = wat.target_kind AND ad.target_id = wat.target_id
  LEFT JOIN payment_events e
    ON e.provider = 'payos'
   AND (
     (wat.target_kind = 'direct_order' AND e.order_id = wat.target_id)
     OR (ad.provider_order_code IS NOT NULL AND (
       e.payload ->> 'orderCode' = ad.provider_order_code::text
       OR e.payload #>> '{data,orderCode}' = ad.provider_order_code::text
     ))
     OR (ad.expected_payment_link_id IS NOT NULL AND (
       e.payload ->> 'paymentLinkId' = ad.expected_payment_link_id
       OR e.payload #>> '{data,paymentLinkId}' = ad.expected_payment_link_id
     ))
   )
  GROUP BY wat.target_kind, wat.target_id
),
evidence_state AS (
  SELECT
    wat.*,
    pee.has_payment_event,
    pee.has_payment_event_after_expiry,
    pee.has_processed_paid_event,
    pee.latest_payment_event_at,
    (
      wat.payment_status = 'paid'
      OR wat.paid_at IS NOT NULL
      OR pee.has_payment_event
    ) AS has_payment_evidence,
    (
      (wat.paid_at IS NOT NULL AND wat.artifact_timestamp IS NOT NULL AND wat.paid_at > wat.artifact_timestamp)
      OR (pee.latest_payment_event_at IS NOT NULL AND wat.artifact_timestamp IS NOT NULL AND pee.latest_payment_event_at > wat.artifact_timestamp)
      OR (wat.lifecycle_changed_at IS NOT NULL AND wat.artifact_timestamp IS NOT NULL AND wat.lifecycle_changed_at > wat.artifact_timestamp)
    ) AS has_payment_or_lifecycle_change_after_artifact
  FROM with_artifact_time wat
  JOIN payment_event_evidence pee ON pee.target_kind = wat.target_kind AND pee.target_id = wat.target_id
),
classified AS (
  SELECT
    es.*,
    CASE
      WHEN artifact_timestamp IS NULL THEN 'UNKNOWN'
      WHEN CURRENT_TIMESTAMP - artifact_timestamp < INTERVAL '24 hours' THEN 'LT_24H'
      WHEN CURRENT_TIMESTAMP - artifact_timestamp <= INTERVAL '7 days' THEN 'D1_TO_D7'
      WHEN CURRENT_TIMESTAMP - artifact_timestamp <= INTERVAL '30 days' THEN 'D8_TO_D30'
      ELSE 'GT_30D'
    END AS artifact_age_bucket,
    CASE
      WHEN payment_expires_at IS NULL THEN 'EXPIRY_UNKNOWN'
      WHEN payment_expires_at > CURRENT_TIMESTAMP THEN 'STILL_UNEXPIRED'
      ELSE 'EXPIRED'
    END AS expiry_state,
    CASE
      -- Ordered, mutually-exclusive final decision contract.
      WHEN has_payment_evidence THEN 'HAS_PAYMENT_EVIDENCE'
      WHEN artifact_timestamp IS NOT NULL
        AND (
          CURRENT_TIMESTAMP - artifact_timestamp <= INTERVAL '30 days'
          OR payment_expires_at > CURRENT_TIMESTAMP
          OR has_payment_or_lifecycle_change_after_artifact
        ) THEN 'RECENT_OR_POTENTIALLY_LIVE'
      WHEN artifact_timestamp IS NOT NULL
        AND CURRENT_TIMESTAMP - artifact_timestamp > INTERVAL '30 days'
        AND payment_expires_at IS NOT NULL
        AND payment_expires_at <= CURRENT_TIMESTAMP
        AND payment_status IN ('unpaid', 'expired')
        AND NOT has_payment_evidence
        AND NOT has_payment_or_lifecycle_change_after_artifact
        THEN 'STALE_LEGACY_SAFE_TO_QUARANTINE'
      ELSE 'UNRESOLVED'
    END AS final_classification
  FROM evidence_state es
),
input_integrity AS (
  SELECT
    (SELECT COUNT(*)::bigint FROM canonical_active) AS canonical_active_input_count,
    (SELECT COUNT(*)::bigint FROM active_distinct) AS canonical_active_distinct_count,
    (SELECT COUNT(*)::bigint FROM classified WHERE target_exists) AS resolved_target_count,
    (SELECT COUNT(*)::bigint FROM classified) AS classified_target_count
),
age_breakdown AS (
  SELECT artifact_age_bucket, COUNT(*)::bigint AS target_count
  FROM classified GROUP BY artifact_age_bucket
),
payment_status_breakdown AS (
  SELECT COALESCE(payment_status, 'UNKNOWN') AS payment_status, COUNT(*)::bigint AS target_count
  FROM classified GROUP BY COALESCE(payment_status, 'UNKNOWN')
),
lifecycle_status_breakdown AS (
  SELECT COALESCE(lifecycle_status, 'NOT_APPLICABLE_OR_UNKNOWN') AS lifecycle_status, COUNT(*)::bigint AS target_count
  FROM classified GROUP BY COALESCE(lifecycle_status, 'NOT_APPLICABLE_OR_UNKNOWN')
),
expiry_breakdown AS (
  SELECT expiry_state, COUNT(*)::bigint AS target_count
  FROM classified GROUP BY expiry_state
),
artifact_breakdown AS (
  SELECT has_payos_artifact, COUNT(*)::bigint AS target_count
  FROM classified GROUP BY has_payos_artifact
),
evidence_breakdown AS (
  SELECT
    has_payment_event_after_expiry,
    has_processed_paid_event,
    has_payment_evidence,
    COUNT(*)::bigint AS target_count
  FROM classified
  GROUP BY has_payment_event_after_expiry, has_processed_paid_event, has_payment_evidence
),
change_breakdown AS (
  SELECT has_payment_or_lifecycle_change_after_artifact, COUNT(*)::bigint AS target_count
  FROM classified GROUP BY has_payment_or_lifecycle_change_after_artifact
),
classification_breakdown AS (
  SELECT final_classification, COUNT(*)::bigint AS target_count
  FROM classified GROUP BY final_classification
)
SELECT jsonb_build_object(
  'input_integrity', jsonb_build_object(
    'canonical_active_input_count', ii.canonical_active_input_count,
    'canonical_active_distinct_count', ii.canonical_active_distinct_count,
    'resolved_target_count', ii.resolved_target_count,
    'classified_target_count', ii.classified_target_count,
    'input_drift_count', (ii.canonical_active_input_count - ii.resolved_target_count)
  ),
  'age_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(ab) ORDER BY ab.artifact_age_bucket) FROM age_breakdown ab), '[]'::jsonb),
  'payment_status_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(pb) ORDER BY pb.payment_status) FROM payment_status_breakdown pb), '[]'::jsonb),
  'lifecycle_status_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(lb) ORDER BY lb.lifecycle_status) FROM lifecycle_status_breakdown lb), '[]'::jsonb),
  'expiry_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(eb) ORDER BY eb.expiry_state) FROM expiry_breakdown eb), '[]'::jsonb),
  'payos_artifact_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(ab) ORDER BY ab.has_payos_artifact) FROM artifact_breakdown ab), '[]'::jsonb),
  'post_expiry_payment_evidence_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(eb) ORDER BY eb.has_payment_event_after_expiry, eb.has_processed_paid_event, eb.has_payment_evidence) FROM evidence_breakdown eb), '[]'::jsonb),
  'payment_or_lifecycle_change_after_artifact_breakdown', COALESCE((SELECT jsonb_agg(to_jsonb(cb) ORDER BY cb.has_payment_or_lifecycle_change_after_artifact) FROM change_breakdown cb), '[]'::jsonb),
  'final_classification_counts', COALESCE((SELECT jsonb_agg(to_jsonb(cb) ORDER BY cb.final_classification) FROM classification_breakdown cb), '[]'::jsonb),
  'remediation_decision', CASE
    WHEN ii.canonical_active_input_count > 0
      AND ii.canonical_active_input_count = ii.canonical_active_distinct_count
      AND ii.canonical_active_input_count = ii.resolved_target_count
      AND NOT EXISTS (SELECT 1 FROM classified WHERE final_classification <> 'STALE_LEGACY_SAFE_TO_QUARANTINE')
      THEN 'PROPOSE_ADDITIVE_QUARANTINE_ONLY'
    ELSE 'KEEP_BLOCKED'
  END
) AS report
FROM input_integrity ii;

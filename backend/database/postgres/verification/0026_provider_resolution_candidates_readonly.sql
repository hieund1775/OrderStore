-- P1 / 0026 provider-resolution candidates. Raw identifiers are returned only
-- to the guarded CLI process for a PayOS GET lookup; the CLI never logs them.
WITH latest_order_lifecycle AS (
  SELECT DISTINCT ON (osh.order_id) osh.order_id, osh.status AS lifecycle_status
  FROM order_status_history osh
  ORDER BY osh.order_id, osh.created_at DESC, osh.id DESC
),
targets AS (
  SELECT
    'direct_order'::text AS target_kind,
    o.id AS target_id,
    o.payos_order_code AS provider_order_code,
    o.total::numeric AS expected_amount,
    o.payment_link_id AS expected_payment_link_id
  FROM orders o
  LEFT JOIN latest_order_lifecycle lol ON lol.order_id = o.id
  WHERE o.checkout_group_id IS NULL
    AND o.payment_provider = 'payos'
    AND o.payment_status IN ('unpaid', 'expired')
    AND COALESCE(lol.lifecycle_status, '') <> 'Đã hủy'
    AND (o.payos_order_code IS NOT NULL OR o.payment_link_id IS NOT NULL)
    AND (
      o.payos_order_code IS NOT NULL OR o.payment_link_id IS NOT NULL
      OR o.payment_checkout_url IS NOT NULL OR o.payment_qr_code IS NOT NULL
      OR o.payment_created_at IS NOT NULL OR o.payment_expires_at IS NOT NULL
    )

  UNION ALL

  SELECT
    'checkout_group'::text AS target_kind,
    cg.id AS target_id,
    cg.payos_order_code AS provider_order_code,
    cg.total_amount::numeric AS expected_amount,
    cg.payment_link_id AS expected_payment_link_id
  FROM checkout_groups cg
  WHERE cg.payment_provider = 'payos'
    AND cg.payment_status IN ('unpaid', 'expired')
    AND (cg.payos_order_code IS NOT NULL OR cg.payment_link_id IS NOT NULL)
    AND (
      cg.payos_order_code IS NOT NULL OR cg.payment_link_id IS NOT NULL
      OR cg.payment_checkout_url IS NOT NULL OR cg.payment_qr_code IS NOT NULL
      OR cg.payment_created_at IS NOT NULL OR cg.payment_expires_at IS NOT NULL
    )
)
SELECT target_kind, target_id, provider_order_code, expected_amount, expected_payment_link_id
FROM targets
ORDER BY target_kind, target_id;

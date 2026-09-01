-- Payment profile code convention:
-- - GROUP_CHECKOUT is the only profile intended for new multi-industry checkout.
-- - Legacy Long profiles remain immutable history and cannot receive new traffic.

INSERT INTO payment_profiles (code, display_name, purpose, env_prefix, status, version)
VALUES (
  'GROUP_CHECKOUT',
  'Thanh toán gộp',
  'grouped_checkout',
  'PAYOS_PROFILE_GROUP_CHECKOUT',
  'disabled',
  1
)
ON CONFLICT (code) DO NOTHING;

-- The original seeded profiles are retained for payment snapshots and historical
-- webhook verification only. They must not be selected for new checkout.
UPDATE payment_profiles
SET status = 'disabled',
    updated_at = CURRENT_TIMESTAMP
WHERE code IN ('LONG_GROUPED_CHECKOUT', 'DEFAULT_LONG')
  AND status = 'active';

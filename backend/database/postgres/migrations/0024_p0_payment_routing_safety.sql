-- P0: resolved-profile routing, global fallback, and grouped-child payment safety.

ALTER TABLE payment_profiles
  DROP CONSTRAINT IF EXISTS chk_payment_profile_purpose;

ALTER TABLE payment_profiles
  ADD CONSTRAINT chk_payment_profile_purpose
  CHECK (purpose IN ('industry', 'grouped_checkout', 'fallback'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_fallback_payment_profile
  ON payment_profiles(purpose)
  WHERE purpose = 'fallback' AND status = 'active';

INSERT INTO payment_profiles (code, display_name, purpose, env_prefix, status, version)
VALUES ('DEFAULT_PROFILE', 'Thanh toan mac dinh', 'fallback', 'PAYOS_PROFILE_DEFAULT_PROFILE', 'disabled', 1)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS original_payment_profile_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS group_allocated_amount NUMERIC(15, 2);

ALTER TABLE checkout_group_allocations
  ADD COLUMN IF NOT EXISTS original_payment_profile_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS allocated_amount NUMERIC(15, 2);

-- Existing group records predate original-profile snapshots. They remain readable;
-- the NOT VALID checks below enforce the invariant on all new writes.
UPDATE checkout_group_allocations
SET allocated_amount = allocated_total
WHERE allocated_amount IS NULL;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS chk_group_child_payment_snapshots;
ALTER TABLE orders
  ADD CONSTRAINT chk_group_child_payment_snapshots
  CHECK (
    checkout_group_id IS NULL
    OR (original_payment_profile_code IS NOT NULL AND group_allocated_amount IS NOT NULL)
  ) NOT VALID;

ALTER TABLE checkout_group_allocations
  DROP CONSTRAINT IF EXISTS chk_group_allocation_payment_snapshots;
ALTER TABLE checkout_group_allocations
  ADD CONSTRAINT chk_group_allocation_payment_snapshots
  CHECK (original_payment_profile_code IS NOT NULL AND allocated_amount IS NOT NULL)
  NOT VALID;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS chk_group_child_has_no_direct_payos_link;
ALTER TABLE orders
  ADD CONSTRAINT chk_group_child_has_no_direct_payos_link
  CHECK (
    checkout_group_id IS NULL
    OR (
      payos_order_code IS NULL
      AND payment_link_id IS NULL
      AND payment_checkout_url IS NULL
      AND payment_qr_code IS NULL
      AND payment_created_at IS NULL
      AND payment_expires_at IS NULL
    )
  ) NOT VALID;

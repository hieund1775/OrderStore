-- Migration 0009: Voucher scope, usage and validity
-- Abort instead of silently truncating counters or changing limited shared vouchers.
DO $$
DECLARE
  invalid_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO invalid_count
  FROM promotions
  WHERE used_count < 0
     OR (voucher_type <> 'single_use' AND usage_limit IS NOT NULL AND usage_limit <= 0)
     OR (voucher_type <> 'single_use' AND usage_limit IS NOT NULL AND used_count > usage_limit)
     OR (end_date IS NOT NULL AND end_date < start_date);

  IF invalid_count > 0 THEN
    RAISE EXCEPTION
      'Migration 0009 aborted: % promotion row(s) violate voucher counters or dates',
      invalid_count;
  END IF;
END $$;

-- Drop the old constraints before replacing the legacy enum value.
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS chk_promotions_dates;
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_voucher_type_check;
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS chk_promotions_voucher_type;
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS chk_promotions_usage;
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS chk_promotions_single_use_no_limit;
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS chk_promotions_used_count_nonnegative;
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS chk_promotions_used_count_limit;

-- Upgrade the legacy usage mode.
UPDATE promotions
SET voucher_type = 'shared'
WHERE voucher_type = 'time_bounded';

-- usage_limit was ignored for single_use in the old runtime, so clearing it preserves semantics.
UPDATE promotions
SET usage_limit = NULL
WHERE voucher_type = 'single_use'
  AND usage_limit IS NOT NULL;

-- Align column defaults/nullability with the new contract.
ALTER TABLE promotions ALTER COLUMN voucher_type SET DEFAULT 'shared';
ALTER TABLE promotions ALTER COLUMN end_date DROP NOT NULL;

-- Enforce all voucher invariants at the database boundary.
ALTER TABLE promotions
  ADD CONSTRAINT chk_promotions_dates CHECK (end_date IS NULL OR end_date >= start_date),
  ADD CONSTRAINT chk_promotions_voucher_type CHECK (voucher_type IN ('single_use', 'shared')),
  ADD CONSTRAINT chk_promotions_usage CHECK (usage_limit IS NULL OR usage_limit > 0),
  ADD CONSTRAINT chk_promotions_single_use_no_limit CHECK (voucher_type <> 'single_use' OR usage_limit IS NULL),
  ADD CONSTRAINT chk_promotions_used_count_nonnegative CHECK (used_count >= 0),
  ADD CONSTRAINT chk_promotions_used_count_limit CHECK (usage_limit IS NULL OR used_count <= usage_limit);

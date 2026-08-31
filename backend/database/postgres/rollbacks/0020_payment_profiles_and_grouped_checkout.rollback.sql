-- ==========================================================
-- Rollback 0020_payment_profiles_and_grouped_checkout.rollback.sql
-- ==========================================================

ALTER TABLE orders DROP COLUMN IF EXISTS receiver_account_holder;
ALTER TABLE orders DROP COLUMN IF EXISTS receiver_account_number;
ALTER TABLE orders DROP COLUMN IF EXISTS receiver_bank_name;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_profile_version;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_profile_code;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_profile_id;
ALTER TABLE orders DROP COLUMN IF EXISTS root_category_id;
ALTER TABLE orders DROP COLUMN IF EXISTS checkout_group_id;

DROP TABLE IF EXISTS checkout_group_allocations CASCADE;
DROP TABLE IF EXISTS checkout_groups CASCADE;

DROP TRIGGER IF EXISTS trg_enforce_root_category_payment_profile ON category_payment_profiles;
DROP FUNCTION IF EXISTS enforce_root_category_payment_profile();
DROP TABLE IF EXISTS category_payment_profiles CASCADE;

DROP TABLE IF EXISTS payment_profiles CASCADE;

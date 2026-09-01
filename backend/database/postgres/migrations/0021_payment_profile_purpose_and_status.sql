-- ==========================================================
-- Migration 0021_payment_profile_purpose_and_status.sql
-- Payment Profile Purpose (Industry vs Grouped Checkout), ENV Status & Active Guard
-- ==========================================================

-- 1. Add purpose column to payment_profiles
ALTER TABLE payment_profiles
    ADD COLUMN IF NOT EXISTS purpose VARCHAR(30);

-- 2. Backfill existing records
-- LONG_GROUPED_CHECKOUT -> grouped_checkout
UPDATE payment_profiles
SET purpose = 'grouped_checkout'
WHERE code = 'LONG_GROUPED_CHECKOUT';

-- All other profiles -> industry
UPDATE payment_profiles
SET purpose = 'industry'
WHERE purpose IS NULL;

-- 3. Set NOT NULL and DEFAULT on purpose, add check constraint
ALTER TABLE payment_profiles
    ALTER COLUMN purpose SET NOT NULL,
    ALTER COLUMN purpose SET DEFAULT 'industry';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_payment_profile_purpose'
    ) THEN
        ALTER TABLE payment_profiles
            ADD CONSTRAINT chk_payment_profile_purpose
            CHECK (purpose IN ('industry', 'grouped_checkout'));
    END IF;
END $$;

-- 4. Update default status to 'disabled'
ALTER TABLE payment_profiles
    ALTER COLUMN status SET DEFAULT 'disabled';

-- 5. Partial unique index: Exactly at most ONE active grouped_checkout profile
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_grouped_checkout_profile
    ON payment_profiles(purpose)
    WHERE purpose = 'grouped_checkout' AND status = 'active';

-- 6. Trigger: Ensure category_payment_profiles only maps to profiles with purpose = 'industry'
CREATE OR REPLACE FUNCTION enforce_root_category_payment_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    cat_parent_id BIGINT;
    cat_depth INT;
    cat_exists BOOLEAN := FALSE;
    prof_purpose VARCHAR(30);
    prof_exists BOOLEAN := FALSE;
BEGIN
    -- Verify category is root and active
    SELECT parent_id, depth, TRUE INTO cat_parent_id, cat_depth, cat_exists
    FROM categories
    WHERE id = NEW.root_category_id AND archived_at IS NULL;

    IF NOT cat_exists THEN
        RAISE EXCEPTION 'Category ID % does not exist or is archived', NEW.root_category_id
            USING ERRCODE = '23503';
    END IF;

    IF cat_parent_id IS NOT NULL OR cat_depth <> 0 THEN
        RAISE EXCEPTION 'Payment profile mapping is only allowed on root categories (depth = 0), category ID % has parent % and depth %',
            NEW.root_category_id, cat_parent_id, cat_depth
            USING ERRCODE = '23514';
    END IF;

    -- Verify profile purpose is 'industry'
    SELECT purpose, TRUE INTO prof_purpose, prof_exists
    FROM payment_profiles
    WHERE id = NEW.payment_profile_id;

    IF NOT prof_exists THEN
        RAISE EXCEPTION 'Payment profile ID % does not exist', NEW.payment_profile_id
            USING ERRCODE = '23503';
    END IF;

    IF prof_purpose <> 'industry' THEN
        RAISE EXCEPTION 'Payment profile mapping is only allowed for industry profiles, profile ID % has purpose "%"',
            NEW.payment_profile_id, prof_purpose
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_root_category_payment_profile ON category_payment_profiles;
CREATE TRIGGER trg_enforce_root_category_payment_profile
    BEFORE INSERT OR UPDATE ON category_payment_profiles
    FOR EACH ROW
    EXECUTE FUNCTION enforce_root_category_payment_profile();

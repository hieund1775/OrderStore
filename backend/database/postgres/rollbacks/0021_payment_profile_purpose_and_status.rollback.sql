-- ==========================================================
-- Rollback 0021_payment_profile_purpose_and_status.rollback.sql
-- CAUTION: Forward-only policy on Production environments.
-- Do NOT execute this rollback on production databases with live payment group history.
-- This rollback script is exclusively for clean test environments and local development.
-- ==========================================================

-- 1. Restore trigger function to migration 0020 version
CREATE OR REPLACE FUNCTION enforce_root_category_payment_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    cat_parent_id BIGINT;
    cat_depth INT;
    cat_exists BOOLEAN := FALSE;
BEGIN
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

    RETURN NEW;
END;
$$;

-- 2. Drop partial unique index
DROP INDEX IF EXISTS uq_active_grouped_checkout_profile;

-- 3. Restore default status to 'pending'
ALTER TABLE payment_profiles
    ALTER COLUMN status SET DEFAULT 'pending';

-- 4. Drop check constraint and purpose column
ALTER TABLE payment_profiles
    DROP CONSTRAINT IF EXISTS chk_payment_profile_purpose;

ALTER TABLE payment_profiles
    DROP COLUMN IF EXISTS purpose;

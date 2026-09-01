-- ==========================================================
-- Migration 0022_normalize_legacy_payment_profile_status.sql
-- `pending` is no longer a manually selectable profile status.
-- Existing rows must behave like newly created disabled profiles.
-- ==========================================================

UPDATE payment_profiles
SET status = 'disabled',
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'pending';

-- ==========================================================
-- Migration 0032_auth_phone_first_password_reset.sql
-- Support phone-first password recovery with persistent proof
-- token and purpose PASSWORD_RESET_PHONE_PROOF.
--
-- WARNING: Additive only. Do not edit migrations 0026-0031.
-- Do not alter payment, reviews, preorder, or catalog tables.
-- ==========================================================

-- 1. Drop existing purpose check constraint on auth_email_challenges and re-add with PASSWORD_RESET_PHONE_PROOF
ALTER TABLE auth_email_challenges
    DROP CONSTRAINT IF EXISTS auth_email_challenges_purpose_check;

ALTER TABLE auth_email_challenges
    ADD CONSTRAINT auth_email_challenges_purpose_check
    CHECK (purpose IN ('PASSWORD_RESET', 'EMAIL_VERIFICATION', 'STAFF_INVITE', 'PASSWORD_RESET_PHONE_PROOF'));

-- 2. Add partial index for fast active phone proof lookup by secret_hash and purpose
CREATE INDEX IF NOT EXISTS idx_aec_active_proof_lookup
    ON auth_email_challenges (secret_hash, purpose)
    WHERE consumed_at IS NULL AND revoked_at IS NULL;

COMMENT ON INDEX idx_aec_active_proof_lookup IS
    'Fast lookup for active unconsumed, unrevoked phone proof tokens and email challenges';

-- 3. Durable Auth Rate Limits table for phone-first recovery and auth throttling
CREATE TABLE IF NOT EXISTS auth_rate_limits (
    rate_key VARCHAR(160) PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 1,
    first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cooldown_until TIMESTAMPTZ DEFAULT NULL
);

COMMENT ON TABLE auth_rate_limits IS
    'Durable persistent rate limiter storage for auth endpoints across process restarts and replicas.';

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_cooldown
    ON auth_rate_limits (cooldown_until)
    WHERE cooldown_until IS NOT NULL;

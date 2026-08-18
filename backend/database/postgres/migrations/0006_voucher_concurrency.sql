-- A single-use voucher may be redeemed by one phone number exactly once.
-- The database constraint is the final guard when two checkout requests race.
CREATE UNIQUE INDEX IF NOT EXISTS uq_voucher_usage_single_phone
    ON voucher_usage_history (promotion_id, user_phone);

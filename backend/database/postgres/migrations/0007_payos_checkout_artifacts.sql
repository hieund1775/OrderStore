-- Persist the PayOS artifacts so idempotent retries can render payment again.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_checkout_url VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS payment_qr_code VARCHAR(1000);

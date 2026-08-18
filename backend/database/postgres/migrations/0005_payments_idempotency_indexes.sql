-- PayOS payment references must identify one order at most. Partial indexes
-- allow non-PayOS orders to retain NULL values while making webhook lookup safe.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_payos_order_code
    ON orders (payos_order_code)
    WHERE payos_order_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_payment_link_id
    ON orders (payment_link_id)
    WHERE payment_link_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_payment_events_order_created
    ON payment_events (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_idempotency_keys_expiry
    ON idempotency_keys (expires_at);

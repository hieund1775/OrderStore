-- ==========================================================
-- Migration 0003_indexes.sql
-- Performance Indexes & Foreign Key Lookup Accelerators
-- ==========================================================

-- 1. Orders & KDS Indexes
CREATE INDEX IF NOT EXISTS ix_orders_store_payment_created
    ON orders (store_id, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_orders_user_created
    ON orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_orders_payment_expiry
    ON orders (payment_provider, payment_status, payment_expires_at)
    WHERE payment_status = 'unpaid';

CREATE INDEX IF NOT EXISTS ix_order_items_order_id
    ON order_items (order_id);

CREATE INDEX IF NOT EXISTS ix_order_item_toppings_item_id
    ON order_item_toppings (order_item_id);

CREATE INDEX IF NOT EXISTS ix_order_status_history_order_created
    ON order_status_history (order_id, created_at DESC);

-- 2. Promotions & Voucher Indexes
CREATE INDEX IF NOT EXISTS ix_voucher_usage_promotion_phone
    ON voucher_usage_history (promotion_id, user_phone, used_at DESC);

CREATE INDEX IF NOT EXISTS ix_promotion_stores_lookup
    ON promotion_stores (store_id, promotion_id);

-- 3. Catalog & Products Indexes
CREATE INDEX IF NOT EXISTS ix_products_category_active
    ON products (category_id, is_available, id);

CREATE INDEX IF NOT EXISTS ix_tables_store_active
    ON tables (store_id, is_active);

-- 4. Auth & Operational Indexes
CREATE INDEX IF NOT EXISTS ix_otp_codes_phone_lookup
    ON otp_codes (phone_normalized, expires_at DESC);

CREATE INDEX IF NOT EXISTS ix_background_jobs_pending
    ON background_jobs (status, run_at)
    WHERE status = 'pending';

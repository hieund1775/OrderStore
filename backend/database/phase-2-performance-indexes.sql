-- ====================================================================
-- Phase 2 Performance Indexes Migration (SQL Server / T-SQL)
-- Target: Optimize Dashboard, Orders list, KDS, History, and Auto-expire
-- Idempotent: Can be safely executed multiple times without error.
-- ====================================================================

-- 1. Orders lookup by store, payment status, and creation date
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_orders_store_payment_created' 
      AND object_id = OBJECT_ID('orders')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_orders_store_payment_created
    ON orders (store_id, payment_status, created_at DESC, id DESC)
    INCLUDE (order_code, total, order_type, table_id, payment_provider);
END;

-- 2. Orders auto-expire scan index
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_orders_payment_expiry' 
      AND object_id = OBJECT_ID('orders')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_orders_payment_expiry
    ON orders (payment_provider, payment_status, payment_expires_at)
    INCLUDE (order_code);
END;

-- 3. Customer order history lookup
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_orders_user_created' 
      AND object_id = OBJECT_ID('orders')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_orders_user_created
    ON orders (user_id, created_at DESC, id DESC)
    INCLUDE (order_code, store_id, total, payment_status, payment_provider, order_type);
END;

-- 4. Order status history latest status covering index
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_order_status_history_order_created' 
      AND object_id = OBJECT_ID('order_status_history')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_order_status_history_order_created
    ON order_status_history (order_id, created_at DESC, id DESC)
    INCLUDE (status, note, changed_by);
END;

-- 5. Order items lookup by order_id (Batch loading)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_order_items_order_id' 
      AND object_id = OBJECT_ID('order_items')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_order_items_order_id
    ON order_items (order_id);
END;

-- 6. Order item toppings lookup by order_item_id (Batch loading)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_order_item_toppings_item_id' 
      AND object_id = OBJECT_ID('order_item_toppings')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_order_item_toppings_item_id
    ON order_item_toppings (order_item_id);
END;

-- 7. Voucher usage history lookup
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_voucher_usage_promotion_phone' 
      AND object_id = OBJECT_ID('voucher_usage_history')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_voucher_usage_promotion_phone
    ON voucher_usage_history (promotion_id, user_phone);
END;

-- ====================================================================
-- Phase 2 Performance Indexes Rollback (SQL Server / T-SQL)
-- Safely drops ONLY the performance indexes created in Phase 2.
-- ====================================================================

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_orders_store_payment_created' AND object_id = OBJECT_ID('orders'))
    DROP INDEX IX_orders_store_payment_created ON orders;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_orders_payment_expiry' AND object_id = OBJECT_ID('orders'))
    DROP INDEX IX_orders_payment_expiry ON orders;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_orders_user_created' AND object_id = OBJECT_ID('orders'))
    DROP INDEX IX_orders_user_created ON orders;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_order_status_history_order_created' AND object_id = OBJECT_ID('order_status_history'))
    DROP INDEX IX_order_status_history_order_created ON order_status_history;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_order_items_order_id' AND object_id = OBJECT_ID('order_items'))
    DROP INDEX IX_order_items_order_id ON order_items;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_order_item_toppings_item_id' AND object_id = OBJECT_ID('order_item_toppings'))
    DROP INDEX IX_order_item_toppings_item_id ON order_item_toppings;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_voucher_usage_promotion_phone' AND object_id = OBJECT_ID('voucher_usage_history'))
    DROP INDEX IX_voucher_usage_promotion_phone ON voucher_usage_history;

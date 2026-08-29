-- ==========================================================
-- Rollback 0017_fulfillment_capabilities.rollback.sql
-- ==========================================================

DROP INDEX IF EXISTS uq_fulfillment_task_order_item;

ALTER TABLE fulfillment_tasks DROP CONSTRAINT IF EXISTS fk_fulfillment_tasks_lane;
ALTER TABLE fulfillment_tasks ADD CONSTRAINT fulfillment_tasks_lane_check CHECK (lane IN ('kitchen', 'packing'));

ALTER TABLE order_items DROP COLUMN IF EXISTS fulfillment_lane;

ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_fulfillment_lane;
ALTER TABLE products ALTER COLUMN fulfillment_lane SET DEFAULT 'kitchen';

ALTER TABLE categories DROP COLUMN IF EXISTS default_fulfillment_lane;

DROP TABLE IF EXISTS branch_fulfillment_capabilities CASCADE;
DROP TABLE IF EXISTS fulfillment_lane_registry CASCADE;

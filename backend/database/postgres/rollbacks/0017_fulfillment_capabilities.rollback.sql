-- ==========================================================
-- Rollback 0017_fulfillment_capabilities.rollback.sql
-- ==========================================================

DELETE FROM catalog_v2_backfill_runs WHERE name = 'catalog-fulfillment-v2';

DROP INDEX IF EXISTS uq_fulfillment_task_order_item;
DROP TRIGGER IF EXISTS trg_fulfillment_task_item_order ON fulfillment_task_items;
DROP FUNCTION IF EXISTS enforce_fulfillment_task_item_order();

ALTER TABLE fulfillment_tasks DROP CONSTRAINT IF EXISTS fk_fulfillment_tasks_lane;
ALTER TABLE fulfillment_tasks ADD CONSTRAINT fulfillment_tasks_lane_check CHECK (lane IN ('kitchen', 'packing'));

ALTER TABLE order_items DROP COLUMN IF EXISTS fulfillment_lane;

ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_fulfillment_lane;
UPDATE products SET fulfillment_lane = 'kitchen' WHERE fulfillment_lane IS NULL;
ALTER TABLE products ALTER COLUMN fulfillment_lane SET DEFAULT 'kitchen';
ALTER TABLE products ALTER COLUMN fulfillment_lane SET NOT NULL;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS fk_categories_default_fulfillment_lane;
ALTER TABLE categories DROP COLUMN IF EXISTS default_fulfillment_lane;

DROP TABLE IF EXISTS branch_fulfillment_capabilities CASCADE;
DROP TABLE IF EXISTS fulfillment_lane_registry CASCADE;

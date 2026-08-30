-- ==========================================================
-- Rollback 0018_fulfillment_and_scope_hardening.rollback.sql
-- ==========================================================

DROP TRIGGER IF EXISTS trg_fulfillment_task_item_order ON fulfillment_task_items;
DROP FUNCTION IF EXISTS enforce_fulfillment_task_item_order();

DROP INDEX IF EXISTS uq_fulfillment_task_order_item;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fulfillment_task_order_item
    ON fulfillment_task_items (task_id, order_item_id)
    WHERE order_item_id IS NOT NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_items_fulfillment_lane;
ALTER TABLE order_items ADD CONSTRAINT fk_order_items_fulfillment_lane
    FOREIGN KEY (fulfillment_lane)
    REFERENCES fulfillment_lane_registry(code) ON DELETE SET NULL;

ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_fulfillment_lane;
ALTER TABLE products ADD CONSTRAINT fk_products_fulfillment_lane
    FOREIGN KEY (fulfillment_lane)
    REFERENCES fulfillment_lane_registry(code) ON DELETE SET NULL;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS fk_categories_default_fulfillment_lane;
ALTER TABLE categories ADD CONSTRAINT fk_categories_default_fulfillment_lane
    FOREIGN KEY (default_fulfillment_lane)
    REFERENCES fulfillment_lane_registry(code) ON DELETE SET NULL;

ALTER TABLE fulfillment_lane_registry DROP CONSTRAINT IF EXISTS chk_fulfillment_handler_type;
ALTER TABLE fulfillment_lane_registry DROP CONSTRAINT IF EXISTS chk_fulfillment_lane_code;

ALTER TABLE product_attribute_overrides DROP CONSTRAINT IF EXISTS chk_product_attribute_selection_bounds;
ALTER TABLE category_attribute_assignments DROP CONSTRAINT IF EXISTS chk_category_attribute_selection_bounds;
ALTER TABLE category_slug_aliases DROP CONSTRAINT IF EXISTS chk_category_slug_alias_normalized;

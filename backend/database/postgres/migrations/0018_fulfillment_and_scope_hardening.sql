-- ==========================================================
-- Migration 0018_fulfillment_and_scope_hardening.sql
-- Hardened DB Constraints for Option Scopes and Fulfillment Integrity
-- ==========================================================

-- 1. Category Slug Aliases: Normalized slug check
ALTER TABLE category_slug_aliases DROP CONSTRAINT IF EXISTS chk_category_slug_alias_normalized;
ALTER TABLE category_slug_aliases ADD CONSTRAINT chk_category_slug_alias_normalized
    CHECK (alias_slug = LOWER(BTRIM(alias_slug)) AND alias_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

-- 2. Option Selection Bounds Checks
ALTER TABLE category_attribute_assignments DROP CONSTRAINT IF EXISTS chk_category_attribute_selection_bounds;
ALTER TABLE category_attribute_assignments ADD CONSTRAINT chk_category_attribute_selection_bounds CHECK (
    (min_selected IS NULL OR min_selected >= 0)
    AND (max_selected IS NULL OR max_selected >= 0)
    AND (min_selected IS NULL OR max_selected IS NULL OR min_selected <= max_selected)
);

ALTER TABLE product_attribute_overrides DROP CONSTRAINT IF EXISTS chk_product_attribute_selection_bounds;
ALTER TABLE product_attribute_overrides ADD CONSTRAINT chk_product_attribute_selection_bounds CHECK (
    (min_selected IS NULL OR min_selected >= 0)
    AND (max_selected IS NULL OR max_selected >= 0)
    AND (min_selected IS NULL OR max_selected IS NULL OR min_selected <= max_selected)
);

-- 3. Fulfillment Lane Registry: Code and Handler Type validation
UPDATE fulfillment_lane_registry
SET handler_type = CASE WHEN code = 'packing' THEN 'packing' ELSE 'kitchen' END
WHERE handler_type NOT IN ('kitchen', 'packing');

ALTER TABLE fulfillment_lane_registry DROP CONSTRAINT IF EXISTS chk_fulfillment_lane_code;
ALTER TABLE fulfillment_lane_registry ADD CONSTRAINT chk_fulfillment_lane_code
    CHECK (code = LOWER(BTRIM(code)) AND code ~ '^[a-z][a-z0-9_-]*$');

ALTER TABLE fulfillment_lane_registry DROP CONSTRAINT IF EXISTS chk_fulfillment_handler_type;
ALTER TABLE fulfillment_lane_registry ADD CONSTRAINT chk_fulfillment_handler_type
    CHECK (handler_type IN ('kitchen', 'packing'));

-- 4. Foreign Key Restrict Policy: Never cascade-null active fulfillment lanes
ALTER TABLE categories DROP CONSTRAINT IF EXISTS fk_categories_default_fulfillment_lane;
ALTER TABLE categories ADD CONSTRAINT fk_categories_default_fulfillment_lane
    FOREIGN KEY (default_fulfillment_lane)
    REFERENCES fulfillment_lane_registry(code) ON DELETE RESTRICT;

ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_fulfillment_lane;
ALTER TABLE products ADD CONSTRAINT fk_products_fulfillment_lane
    FOREIGN KEY (fulfillment_lane)
    REFERENCES fulfillment_lane_registry(code) ON DELETE RESTRICT;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_items_fulfillment_lane;
ALTER TABLE order_items ADD CONSTRAINT fk_order_items_fulfillment_lane
    FOREIGN KEY (fulfillment_lane)
    REFERENCES fulfillment_lane_registry(code) ON DELETE RESTRICT;

-- 5. Hardened Task-Item Uniqueness and Cross-Order Integrity Trigger
DROP INDEX IF EXISTS uq_fulfillment_task_order_item;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fulfillment_task_order_item
    ON fulfillment_task_items (order_item_id)
    WHERE order_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_fulfillment_task_item_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    task_order_id BIGINT;
    item_order_id BIGINT;
BEGIN
    IF NEW.order_item_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT order_id INTO task_order_id FROM fulfillment_tasks WHERE id = NEW.task_id;
    SELECT order_id INTO item_order_id FROM order_items WHERE id = NEW.order_item_id;
    IF task_order_id IS NULL OR item_order_id IS NULL OR task_order_id <> item_order_id THEN
        RAISE EXCEPTION 'fulfillment task and order item must belong to the same order'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fulfillment_task_item_order ON fulfillment_task_items;
CREATE TRIGGER trg_fulfillment_task_item_order
BEFORE INSERT OR UPDATE OF task_id, order_item_id ON fulfillment_task_items
FOR EACH ROW EXECUTE FUNCTION enforce_fulfillment_task_item_order();

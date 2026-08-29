-- ==========================================================
-- Rollback 0015_root_category_navigation.rollback.sql
-- ==========================================================

-- 1. Restore old parent_id and depth for categories moved during backfill
UPDATE categories c
SET parent_id = h.old_parent_id,
    depth = h.old_depth,
    updated_at = CURRENT_TIMESTAMP
FROM catalog_category_reparent_history h
WHERE c.id = h.category_id;

-- 2. Delete created root category if it has no remaining children or products
DELETE FROM categories c
WHERE c.id IN (
    SELECT DISTINCT h.root_category_id
    FROM catalog_category_reparent_history h
    WHERE h.root_was_created = TRUE
)
AND NOT EXISTS (
    SELECT 1 FROM categories child WHERE child.parent_id = c.id
)
AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.category_id = c.id
);

-- 3. Drop audit table
DROP TABLE IF EXISTS catalog_category_reparent_history CASCADE;

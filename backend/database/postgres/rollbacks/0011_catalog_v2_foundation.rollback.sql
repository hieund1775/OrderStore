-- ==========================================================
-- Rollback 0011_catalog_v2_foundation.rollback.sql
-- Reverses Migration 0011_catalog_v2_foundation.sql
-- ==========================================================

-- 1. Drop Supporting Indexes
DROP INDEX IF EXISTS idx_product_media_product_id;
DROP INDEX IF EXISTS idx_product_variants_sku;
DROP INDEX IF EXISTS idx_product_variants_product_id;
DROP INDEX IF EXISTS idx_products_schema_id;
DROP INDEX IF EXISTS idx_attribute_values_def_id;
DROP INDEX IF EXISTS idx_attribute_definitions_schema_id;
DROP INDEX IF EXISTS idx_product_type_schemas_type_id;
DROP INDEX IF EXISTS idx_product_types_code;
DROP INDEX IF EXISTS idx_categories_depth;
DROP INDEX IF EXISTS idx_categories_parent_id;

-- 2. Drop Catalog V2 Child Tables
DROP TABLE IF EXISTS product_media;
DROP TABLE IF EXISTS product_modifier_values;
DROP TABLE IF EXISTS product_variant_values;
DROP TABLE IF EXISTS product_variants;

-- 3. Revert products table extensions
ALTER TABLE products
    DROP CONSTRAINT IF EXISTS chk_products_stock_mode,
    DROP CONSTRAINT IF EXISTS chk_products_fulfillment_lane,
    DROP CONSTRAINT IF EXISTS chk_products_status,
    DROP COLUMN IF EXISTS stock_mode,
    DROP COLUMN IF EXISTS fulfillment_lane,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS product_type_schema_id;

-- 4. Drop Attribute Definitions & Schemas
DROP TABLE IF EXISTS attribute_values;
DROP TABLE IF EXISTS attribute_definitions;
DROP TABLE IF EXISTS product_type_schemas;

-- 5. Revert categories table extensions & drop product_types
ALTER TABLE categories
    DROP CONSTRAINT IF EXISTS fk_categories_product_type,
    DROP CONSTRAINT IF EXISTS chk_categories_depth,
    DROP COLUMN IF EXISTS archived_at,
    DROP COLUMN IF EXISTS product_type_id,
    DROP COLUMN IF EXISTS depth,
    DROP COLUMN IF EXISTS parent_id;

DROP TABLE IF EXISTS product_types;

-- 6. Revert users admin_role check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_admin_role_check;
ALTER TABLE users ADD CONSTRAINT users_admin_role_check
    CHECK (admin_role IN ('super', 'manager', 'kitchen', 'cashier'));

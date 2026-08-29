-- ==========================================================
-- Rollback 0016_catalog_option_scopes.rollback.sql
-- ==========================================================

DROP TABLE IF EXISTS product_attribute_overrides CASCADE;
DROP TABLE IF EXISTS category_attribute_assignments CASCADE;
DROP TABLE IF EXISTS category_slug_aliases CASCADE;

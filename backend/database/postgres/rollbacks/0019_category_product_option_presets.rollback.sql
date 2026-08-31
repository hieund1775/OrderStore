-- ==========================================================
-- Rollback 0019_category_product_option_presets.rollback.sql
-- ==========================================================

DROP VIEW IF EXISTS v_legacy_root_products_preflight;
DROP TRIGGER IF EXISTS trg_preset_value_attribute_match ON catalog_option_preset_values;
DROP FUNCTION IF EXISTS enforce_preset_value_attribute_match();
DROP TRIGGER IF EXISTS trg_catalog_option_preset_target ON catalog_option_presets;
DROP FUNCTION IF EXISTS enforce_catalog_option_preset_target();
DROP TABLE IF EXISTS catalog_option_preset_values CASCADE;
DROP TABLE IF EXISTS catalog_option_presets CASCADE;

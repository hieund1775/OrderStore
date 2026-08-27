-- ==========================================================
-- Rollback 0012_branch_offers_inventory.rollback.sql
-- Reverses Migration 0012_branch_offers_inventory.sql
-- ==========================================================

-- 1. Drop Supporting Indexes
DROP INDEX IF EXISTS idx_inventory_reservations_status_expires;
DROP INDEX IF EXISTS idx_inventory_movements_store_variant;
DROP INDEX IF EXISTS idx_branch_inventory_store_variant;
DROP INDEX IF EXISTS idx_branch_offers_store_variant;

-- 2. Drop Tables
DROP TABLE IF EXISTS inventory_reservations;
DROP TABLE IF EXISTS inventory_movements;
DROP TABLE IF EXISTS branch_variant_inventory;
DROP TABLE IF EXISTS branch_variant_offers;

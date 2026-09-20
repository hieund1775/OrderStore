-- ==========================================================
-- Migration 0035_branch_fulfillment_capabilities_default.sql
-- Baseline branch fulfillment capabilities seeding for all stores
--
-- WARNING: Additive only. Do not edit migrations 0001-0034.
-- ==========================================================

-- 1. Seed baseline capabilities for all stores and active lanes
INSERT INTO branch_fulfillment_capabilities (store_id, lane_code, is_enabled)
SELECT s.id, flr.code, TRUE
FROM stores s
CROSS JOIN fulfillment_lane_registry flr
WHERE flr.is_active = TRUE
ON CONFLICT (store_id, lane_code) DO NOTHING;

-- 2. Normalize Store 2 packing capability to active baseline
UPDATE branch_fulfillment_capabilities
SET is_enabled = TRUE, updated_at = CURRENT_TIMESTAMP
WHERE store_id = 2 AND lane_code = 'packing';

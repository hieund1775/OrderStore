-- ==========================================================
-- Migration 0039_store_amenities_sync.sql
-- Synchronize amenities field for stores to ensure consistent rich amenities
--
-- WARNING: Additive only. Do not edit migrations 0001-0038.
-- ==========================================================

-- 1. Set default JSON array of amenities for new stores
ALTER TABLE stores
  ALTER COLUMN amenities SET DEFAULT '["Chỗ đỗ ô tô", "Máy lạnh", "Mua mang đi", "Giao 25p", "Không gian thoáng"]';

-- 2. Backfill existing active and inactive stores having NULL, empty, or placeholder amenities
UPDATE stores
SET amenities = '["Chỗ đỗ ô tô", "Máy lạnh", "Mua mang đi", "Giao 25p", "Không gian thoáng"]'
WHERE amenities IS NULL
   OR TRIM(amenities) = ''
   OR TRIM(amenities) = '[]'
   OR TRIM(amenities) = '["wifi"]';

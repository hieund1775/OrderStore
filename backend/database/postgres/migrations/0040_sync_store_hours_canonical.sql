-- 0040_sync_store_hours_canonical.sql
-- Ensure canonical operating hours for stores (fixing 08:00 - 09:00 typo for store 1 to 08:00 - 21:00)

UPDATE stores
SET hours = '08:00 – 21:00'
WHERE id = 1 OR hours ILIKE '%08:00%09:00%' OR hours ILIKE '%8:00%9:00%';

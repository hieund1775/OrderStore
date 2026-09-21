-- ==========================================================
-- Migration 0037_fix_qa_voucher_and_category_typos.sql
-- Fix data typos:
-- 1. Correct voucher NEW1000% -> NEW100% in code, title, and rule
-- 2. Correct Vietnamese diacritic typo Aó -> Áo in category names and product names
-- ==========================================================

-- 1. Fix voucher typos
UPDATE promotions
SET
    code = REPLACE(code, 'NEW1000%', 'NEW100%'),
    title = REPLACE(title, 'NEW1000%', 'NEW100%'),
    description = CASE WHEN description IS NOT NULL THEN REPLACE(description, 'NEW1000%', 'NEW100%') ELSE description END
WHERE code LIKE '%NEW1000%%' OR title LIKE '%NEW1000%%';

-- Also ensure exact match update
UPDATE promotions
SET code = 'NEW100%'
WHERE code = 'NEW1000%';

-- 2. Fix Vietnamese diacritic typo in categories (Aó -> Áo)
UPDATE categories
SET name = REPLACE(name, 'Aó', 'Áo')
WHERE name LIKE '%Aó%';

-- Also fix products if any products have Aó in name
UPDATE products
SET name = REPLACE(name, 'Aó', 'Áo')
WHERE name LIKE '%Aó%';

-- 3. Fix store operating hours typo (08:00 - 09:00 -> 08:00 - 21:00)
UPDATE stores
SET hours = '08:00 – 21:00'
WHERE hours ILIKE '%08:00%09:00%' OR hours ILIKE '%8:00%9:00%';


-- ==========================================================
-- Migration 0036_scoped_category_uniqueness.sql
-- Allow subcategories with identical names across different parent root categories
-- while preserving root uniqueness and sibling uniqueness within the same parent.
--
-- WARNING: Additive/refinement only. Do not edit migrations 0001-0035.
-- ==========================================================

-- 1. Drop global UNIQUE (name) constraint on categories
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;

-- 2. Enforce uniqueness of root category names among active roots (parent_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_root_name
    ON categories (name)
    WHERE parent_id IS NULL AND archived_at IS NULL;

-- 3. Enforce uniqueness of subcategory names within the same parent category among active subcategories
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_sub_parent_name
    ON categories (parent_id, name)
    WHERE parent_id IS NOT NULL AND archived_at IS NULL;

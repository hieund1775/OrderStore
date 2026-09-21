-- Rollback for 0036_scoped_category_uniqueness.sql
DROP INDEX IF EXISTS uq_categories_sub_parent_name;
DROP INDEX IF EXISTS uq_categories_root_name;
ALTER TABLE categories ADD CONSTRAINT categories_name_key UNIQUE (name);

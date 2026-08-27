-- ==========================================================
-- Rollback 0014_fulfillment_lanes.rollback.sql
-- ==========================================================

DROP TABLE IF EXISTS fulfillment_task_items CASCADE;
DROP TABLE IF EXISTS fulfillment_tasks CASCADE;

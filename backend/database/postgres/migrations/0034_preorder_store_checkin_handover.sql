-- ==========================================================
-- Migration 0034_preorder_store_checkin_handover.sql
-- Additive preorder store check-in and handover confirmation fields.
--
-- WARNING: Additive only. Do not edit migrations 0001-0033.
-- Do not alter payment-attempt, review, auth, or catalog tables.
-- All timestamps are TIMESTAMPTZ.
-- ==========================================================

ALTER TABLE preorders
  ADD COLUMN IF NOT EXISTS handover_confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS handover_confirmed_by BIGINT NULL REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS handover_overdue_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_preorders_active_schedule
  ON preorders(status, scheduled_start_at)
  WHERE status IN ('PENDING_MANAGER_CONFIRMATION', 'CONFIRMED', 'CHECKED_IN');

CREATE INDEX IF NOT EXISTS idx_preorders_handover_overdue
  ON preorders(store_id, scheduled_start_at)
  WHERE checked_in_at IS NOT NULL AND completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_preorders_unchecked_in_active
  ON preorders(store_id, scheduled_start_at)
  WHERE checked_in_at IS NULL AND status IN ('PENDING_MANAGER_CONFIRMATION', 'CONFIRMED');

COMMENT ON COLUMN preorders.handover_confirmed_at IS
  'Timestamp when store staff (Manager/Super) confirmed physical handover to customer.';

COMMENT ON COLUMN preorders.handover_confirmed_by IS
  'FK to users(id) identifying the Manager/Super who confirmed handover.';

COMMENT ON COLUMN preorders.handover_overdue_at IS
  'Timestamp when closing due processor marked checked-in preorder as overdue for handover.';

-- 0008_promotion_archive_notifications.sql
-- Adds deleted_at for soft-archiving promotions and indexes for user notifications

ALTER TABLE promotions
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_promotions_deleted_at
    ON promotions (deleted_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id, is_read, created_at DESC);

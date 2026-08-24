import postgresDb from '../../config/db-postgres.js';

export class NotificationRepositoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function createNotificationsRepository(database = postgresDb) {
  return {
    async insertForUser({ userId, type = 'system', title, body, link }, { tx } = {}) {
      const executor = tx || database;
      const targetUserId = Number(userId);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        throw new NotificationRepositoryError('ID người nhận không hợp lệ');
      }
      if (!title || !String(title).trim()) {
        throw new NotificationRepositoryError('Tiêu đề thông báo không được để trống');
      }

      const [rows] = await executor.query(
        `INSERT INTO notifications (user_id, type, title, body, link, is_read)
         VALUES ($1, $2, $3, $4, $5, FALSE)
         RETURNING *`,
        [targetUserId, type, String(title).trim(), body ? String(body).trim() : null, link || null],
      );
      return rows[0];
    },

    async fanOutToOrderAdmins(storeId, { type = 'order', title, body, link }, { tx } = {}) {
      const executor = tx || database;
      if (!title || !String(title).trim()) {
        throw new NotificationRepositoryError('Tiêu đề thông báo không được để trống');
      }

      const normalizedStoreId = storeId ? Number(storeId) : null;
      const [rows] = await executor.query(
        `INSERT INTO notifications (user_id, type, title, body, link, is_read)
         SELECT DISTINCT u.id, $1, $2, $3, $4, FALSE
         FROM users u
         WHERE u.is_admin = TRUE
           AND (
             u.admin_role = 'super'
             OR (
               u.admin_role IN ('manager', 'kitchen')
               AND ($5::bigint IS NULL OR u.admin_branch_id = $5 OR u.admin_branch_id IS NULL)
             )
           )
         RETURNING id, user_id`,
        [
          type,
          String(title).trim(),
          body ? String(body).trim() : null,
          link || null,
          normalizedStoreId,
        ],
      );
      return rows;
    },

    async fanOutToRecruitmentAdmins(storeId, { type = 'staff', title, body, link }, { tx } = {}) {
      const executor = tx || database;
      if (!title || !String(title).trim()) {
        throw new NotificationRepositoryError('Tiêu đề thông báo không được để trống');
      }

      const normalizedStoreId = storeId ? Number(storeId) : null;
      const [rows] = await executor.query(
        `INSERT INTO notifications (user_id, type, title, body, link, is_read)
         SELECT DISTINCT u.id, $1, $2, $3, $4, FALSE
         FROM users u
         WHERE u.is_admin = TRUE
           AND (
             u.admin_role = 'super'
             OR (
               $5::bigint IS NOT NULL
               AND u.admin_role = 'manager'
               AND (u.admin_branch_id = $5 OR u.admin_branch_id IS NULL)
             )
           )
         RETURNING id, user_id`,
        [
          type,
          String(title).trim(),
          body ? String(body).trim() : null,
          link || null,
          normalizedStoreId,
        ],
      );
      return rows;
    },

    async listForUser(userId, limit = 50) {
      const targetUserId = Number(userId);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) return [];
      const parsedLimit = Math.min(Math.max(1, Number(limit) || 50), 100);

      const [rows] = await database.query(
        `SELECT *
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [targetUserId, parsedLimit],
      );
      return rows;
    },

    async countUnreadForUser(userId) {
      const targetUserId = Number(userId);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) return 0;

      const [rows] = await database.query(
        `SELECT COUNT(*)::int AS count
         FROM notifications
         WHERE user_id = $1 AND is_read = FALSE`,
        [targetUserId],
      );
      return rows[0]?.count ?? 0;
    },

    async markOneRead(userId, notificationId) {
      const targetUserId = Number(userId);
      const targetNotifId = Number(notificationId);
      if (!Number.isInteger(targetUserId) || !Number.isInteger(targetNotifId)) return false;

      const [rows] = await database.query(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [targetNotifId, targetUserId],
      );
      return rows.length > 0;
    },

    async markAllRead(userId) {
      const targetUserId = Number(userId);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) return 0;

      const [, affected] = await database.query(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE user_id = $1 AND is_read = FALSE`,
        [targetUserId],
      );
      return affected ?? 0;
    },

    async clearAll(userId) {
      const targetUserId = Number(userId);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) return 0;

      const [, affected] = await database.query(
        `DELETE FROM notifications
         WHERE user_id = $1`,
        [targetUserId],
      );
      return affected ?? 0;
    },
  };
}

export const notificationsRepository = createNotificationsRepository();
export default notificationsRepository;

import postgresDb from '../../config/db-postgres.js';

export class NotificationRepositoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function createNotificationsRepository(database = postgresDb) {
  return {
    async findActiveUserById(userId) {
      const targetUserId = Number(userId);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) return null;
      const [rows] = await database.query(
        `SELECT id, is_admin, admin_role
         FROM users
         WHERE id = $1 AND is_active = TRUE`,
        [targetUserId],
      );
      return rows[0] || null;
    },

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

      const normalizedStoreId = Number(storeId);
      if (!Number.isInteger(normalizedStoreId) || normalizedStoreId <= 0) {
        throw new NotificationRepositoryError('ID chi nhánh đơn hàng không hợp lệ');
      }
      const [rows] = await executor.query(
        `INSERT INTO notifications (user_id, type, title, body, link, is_read)
         SELECT DISTINCT u.id, $1, $2, $3, $4, FALSE
         FROM users u
         WHERE u.is_admin = TRUE
           AND u.is_active = TRUE
           AND (
             u.admin_role = 'super'
             OR (
               u.admin_role IN ('manager', 'kitchen')
               AND u.admin_branch_id = $5
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
           AND u.is_active = TRUE
           AND (
             u.admin_role = 'super'
             OR (
               $5::bigint IS NOT NULL
               AND u.admin_role = 'manager'
               AND u.admin_branch_id = $5
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

    async fanOutToSuperAdmins({ type = 'system', title, body, link }, { tx } = {}) {
      const executor = tx || database;
      if (!title || !String(title).trim()) {
        throw new NotificationRepositoryError('Tiêu đề thông báo không được để trống');
      }

      const [rows] = await executor.query(
        `INSERT INTO notifications (user_id, type, title, body, link, is_read)
         SELECT DISTINCT u.id, $1, $2, $3, $4, FALSE
         FROM users u
         WHERE u.is_admin = TRUE
           AND u.is_active = TRUE
           AND u.admin_role = 'super'
         RETURNING id, user_id`,
        [
          type,
          String(title).trim(),
          body ? String(body).trim() : null,
          link || null,
        ],
      );
      return rows;
    },

    async listForUser(userId, limitOrOptions = 50, options = {}) {
      const targetUserId = Number(userId);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) return [];

      const opts = typeof limitOrOptions === 'object' && limitOrOptions !== null
        ? limitOrOptions
        : { limit: limitOrOptions, ...options };

      const parsedLimit = Math.min(Math.max(1, Number(opts.limit) || 50), 100);
      const isPaginated = opts.page != null;

      const params = [targetUserId];
      let where = 'WHERE user_id = $1';
      if (opts.type && opts.type !== 'all') {
        params.push(opts.type);
        where += ` AND type = $${params.length}`;
      }

      let countColumn = '';
      let paginationClause = '';
      if (isPaginated) {
        const parsedPage = Math.max(1, Number(opts.page) || 1);
        countColumn = ', COUNT(*) OVER() AS total_count';
        params.push(parsedLimit);
        const limitParam = `$${params.length}`;
        params.push((parsedPage - 1) * parsedLimit);
        const offsetParam = `$${params.length}`;
        paginationClause = ` LIMIT ${limitParam} OFFSET ${offsetParam}`;
      } else {
        params.push(parsedLimit);
        paginationClause = ` LIMIT $${params.length}`;
      }

      const [rows] = await database.query(
        `SELECT *
                ${countColumn}
         FROM notifications
         ${where}
         ORDER BY created_at DESC, id DESC
         ${paginationClause}`,
        params,
      );

      if (!isPaginated) return rows;

      let totalItems = 0;
      if (rows.length > 0) {
        totalItems = Number(rows[0].total_count) || 0;
      } else if (Number(opts.page) > 1) {
        const countParams = [targetUserId];
        let countWhere = 'WHERE user_id = $1';
        if (opts.type && opts.type !== 'all') {
          countParams.push(opts.type);
          countWhere += ` AND type = $${countParams.length}`;
        }
        const [countRows] = await database.query(
          `SELECT COUNT(*)::int AS total FROM notifications ${countWhere}`,
          countParams,
        );
        totalItems = Number(countRows[0]?.total) || 0;
      }
      return { items: rows, totalItems };
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

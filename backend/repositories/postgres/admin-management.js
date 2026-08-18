import postgresDb from '../../config/db-postgres.js';

export class AdminManagementError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function createAdminManagementRepository(database = postgresDb) {
  return {
    async listCustomers({ scopedStoreId, search, tier, limit = 50, offset = 0 } = {}) {
      const params = [];
      let where = 'WHERE u.is_admin = FALSE';

      if (scopedStoreId) {
        params.push(scopedStoreId);
        where += ` AND EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.store_id = $${params.length})`;
      }
      if (tier) {
        params.push(tier);
        where += ` AND u.tier = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        where += ` AND (u.fullname ILIKE $${params.length} OR u.phone ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
      }

      params.push(limit);
      const limitParam = `$${params.length}`;
      params.push(offset);
      const offsetParam = `$${params.length}`;

      const [rows] = await database.query(
        `SELECT u.id, u.fullname, u.phone, u.email, u.avatar_url, u.address, u.tier, u.points,
                u.total_spent, u.is_active, u.created_at,
                COUNT(o.id)::int AS orders_count,
                MAX(o.created_at) AS last_order_at
         FROM users u
         LEFT JOIN orders o ON o.user_id = u.id ${scopedStoreId ? 'AND o.store_id = $1' : ''}
         ${where}
         GROUP BY u.id
         ORDER BY u.total_spent DESC
         LIMIT ${limitParam} OFFSET ${offsetParam}`,
        params,
      );
      return rows;
    },

    async getCustomerDetail(customerId, { scopedStoreId } = {}) {
      if (scopedStoreId) {
        const [matched] = await database.query(
          'SELECT 1 FROM orders WHERE user_id = $1 AND store_id = $2 LIMIT 1',
          [customerId, scopedStoreId],
        );
        if (!matched[0]) {
          throw new AdminManagementError('Khách hàng chưa từng đặt đơn tại chi nhánh của bạn', 403);
        }
      }

      const [users] = await database.query(
        'SELECT id, fullname, phone, email, avatar_url, address, tier, points, total_spent, created_at FROM users WHERE id = $1 AND is_admin = FALSE',
        [customerId],
      );
      const customer = users[0];
      if (!customer) throw new AdminManagementError('Không tìm thấy khách hàng', 404);

      const orderParams = [customerId];
      let orderWhere = 'WHERE o.user_id = $1';
      if (scopedStoreId) {
        orderParams.push(scopedStoreId);
        orderWhere += ` AND o.store_id = $${orderParams.length}`;
      }

      const [orders] = await database.query(
        `SELECT o.id, o.order_code, o.total, o.payment_status, o.created_at, s.name AS store_name,
                latest.status AS current_status
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         LEFT JOIN LATERAL (SELECT status FROM order_status_history osh WHERE osh.order_id = o.id ORDER BY osh.created_at DESC, osh.id DESC LIMIT 1) latest ON TRUE
         ${orderWhere}
         ORDER BY o.created_at DESC
         LIMIT 20`,
        orderParams,
      );

      const [ltvRows] = await database.query(
        `SELECT COUNT(o.id)::int AS total_orders,
                COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total ELSE 0 END), 0)::bigint AS actual_spent,
                COALESCE(AVG(CASE WHEN o.payment_status = 'paid' THEN o.total ELSE NULL END), 0)::int AS avg_order_value
         FROM orders o
         ${orderWhere}`,
        orderParams,
      );

      return {
        ...customer,
        orders,
        stats: ltvRows[0] || { total_orders: 0, actual_spent: 0, avg_order_value: 0 },
      };
    },

    async listAccounts() {
      const [rows] = await database.query(
        `SELECT u.id, u.fullname, u.email, u.admin_role AS role,
                COALESCE(s.name, 'Toàn hệ thống') AS branch,
                u.is_active AS active
         FROM users u
         LEFT JOIN stores s ON u.admin_branch_id = s.id
         WHERE u.is_admin = TRUE
         ORDER BY u.id`,
      );
      return rows;
    },

    async listAuditLogs({ limit = 100 } = {}) {
      const [rows] = await database.query(
        `SELECT al.*, u.fullname AS user_name, u.email
         FROM audit_logs al
         JOIN users u ON al.user_id = u.id
         ORDER BY al.created_at DESC
         LIMIT $1`,
        [limit],
      );
      return rows;
    },

    async listNotifications({ userId, role, limit = 50 } = {}) {
      const params = [];
      let where = 'WHERE TRUE';
      if (role !== 'super') {
        params.push(userId);
        where += ` AND (user_id = $${params.length} OR user_id IS NULL)`;
      }
      params.push(limit);
      const [rows] = await database.query(
        `SELECT * FROM notifications
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
      );
      return rows;
    },

    async createNotification({ user_id, type = 'system', title, body, link }) {
      if (!title || !title.trim()) throw new AdminManagementError('Thiếu tiêu đề thông báo');
      const [rows] = await database.query(
        `INSERT INTO notifications (user_id, type, title, body, link)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [user_id || null, type || 'system', title.trim(), body || null, link || null],
      );
      return rows[0];
    },
  };
}

export const adminManagementRepository = createAdminManagementRepository();
export default adminManagementRepository;

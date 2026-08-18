import postgresDb from '../../config/db-postgres.js';

export function createAdminReportsRepository(database = postgresDb) {
  return {
    async getKPI({ scopedStoreId } = {}) {
      const params = [];
      let storeCond = '';
      if (scopedStoreId) {
        params.push(scopedStoreId);
        storeCond = ` AND store_id = $${params.length}`;
      }

      const [todayRev] = await database.query(
        `SELECT COALESCE(SUM(total), 0)::bigint AS v
         FROM orders
         WHERE created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'
           AND payment_status = 'paid'
           AND id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')
           ${storeCond}`,
        params,
      );

      const [yesterdayRev] = await database.query(
        `SELECT COALESCE(SUM(total), 0)::bigint AS v
         FROM orders
         WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE
           AND payment_status = 'paid'
           AND id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')
           ${storeCond}`,
        params,
      );

      const [todayOrders] = await database.query(
        `SELECT COUNT(*)::int AS total, COALESCE(AVG(total), 0)::int AS avg
         FROM orders
         WHERE created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'
           AND payment_status = 'paid'
           AND id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')
           ${storeCond}`,
        params,
      );

      const [todayCancel] = await database.query(
        `SELECT COUNT(*)::int AS v
         FROM orders o
         WHERE o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day'
           AND EXISTS (SELECT 1 FROM order_status_history osh WHERE osh.order_id = o.id AND osh.status = 'Đã hủy')
           ${scopedStoreId ? ' AND o.store_id = $1' : ''}`,
        scopedStoreId ? [scopedStoreId] : [],
      );

      const [todayCups] = await database.query(
        `SELECT COALESCE(SUM(oi.qty), 0)::int AS v
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day'
           AND o.payment_status = 'paid'
           AND o.id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')
           ${scopedStoreId ? ' AND o.store_id = $1' : ''}`,
        scopedStoreId ? [scopedStoreId] : [],
      );

      const revToday = Number(todayRev[0]?.v || 0);
      const revYest = Number(yesterdayRev[0]?.v || 0);
      const revChange = revYest > 0 ? +(((revToday - revYest) / revYest) * 100).toFixed(1) : 0;
      const totalOrd = Number(todayOrders[0]?.total || 0);
      const cancelOrd = Number(todayCancel[0]?.v || 0);
      const cancelRate = totalOrd + cancelOrd > 0 ? +((cancelOrd / (totalOrd + cancelOrd)) * 100).toFixed(1) : 0;

      return {
        revenue: { value: revToday, change: revChange, target: 10000000 },
        orders: { value: totalOrd, change: 0, target: 200 },
        avg_order: { value: Number(todayOrders[0]?.avg || 0), change: 0 },
        cancel_rate: { value: cancelRate, change: 0, count: cancelOrd },
        cups_sold: { value: Number(todayCups[0]?.v || 0), change: 0 },
      };
    },

    async getUrgent({ scopedStoreId } = {}) {
      const params = [];
      let storeCond = '';
      if (scopedStoreId) {
        params.push(scopedStoreId);
        storeCond = ` WHERE store_id = $${params.length}`;
      }

      const [lowStock] = await database.query(
        `SELECT COUNT(*)::int AS v FROM ingredients WHERE stock <= safe_level ${scopedStoreId ? 'AND store_id = $1' : ''}`,
        scopedStoreId ? [scopedStoreId] : [],
      );

      const [paused] = await database.query(
        'SELECT COUNT(*)::int AS v FROM products WHERE is_available = FALSE',
      );

      const [preparing] = await database.query(
        `SELECT COUNT(*)::int AS v
         FROM orders o
         JOIN LATERAL (SELECT status FROM order_status_history osh WHERE osh.order_id = o.id ORDER BY osh.created_at DESC, osh.id DESC LIMIT 1) latest ON TRUE
         WHERE latest.status IN ('Đang chuẩn bị', 'Chờ xác nhận')
           AND o.payment_status = 'paid'
           ${scopedStoreId ? ' AND o.store_id = $1' : ''}`,
        scopedStoreId ? [scopedStoreId] : [],
      );

      return {
        low_stock: lowStock[0]?.v || 0,
        paused_items: paused[0]?.v || 0,
        preparing_orders: preparing[0]?.v || 0,
      };
    },

    async getRevenueByHour({ scopedStoreId, date } = {}) {
      const params = [];
      let where = `WHERE o.created_at >= CURRENT_DATE AND o.created_at < CURRENT_DATE + INTERVAL '1 day'
                     AND o.payment_status = 'paid'
                     AND o.id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')`;
      if (scopedStoreId) {
        params.push(scopedStoreId);
        where += ` AND o.store_id = $${params.length}`;
      }

      const [rows] = await database.query(
        `SELECT EXTRACT(HOUR FROM o.created_at)::int AS hour,
                COALESCE(SUM(o.total), 0)::bigint AS revenue,
                COUNT(*)::int AS orders
         FROM orders o
         ${where}
         GROUP BY EXTRACT(HOUR FROM o.created_at)
         ORDER BY hour`,
        params,
      );
      return rows;
    },

    async getRevenueByCategory({ scopedStoreId, dateFrom, dateTo } = {}) {
      const params = [];
      let where = `WHERE o.payment_status = 'paid'
                     AND o.id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')`;
      if (scopedStoreId) {
        params.push(scopedStoreId);
        where += ` AND o.store_id = $${params.length}`;
      }
      if (dateFrom) {
        params.push(dateFrom);
        where += ` AND o.created_at >= $${params.length}`;
      }
      if (dateTo) {
        params.push(dateTo);
        where += ` AND o.created_at < $${params.length}`;
      }

      const [rows] = await database.query(
        `SELECT c.id, c.name,
                COALESCE(SUM(oi.line_total), 0)::bigint AS revenue,
                COALESCE(SUM(oi.qty), 0)::int AS items_sold
         FROM categories c
         JOIN products p ON p.category_id = c.id
         JOIN order_items oi ON oi.product_id = p.id
         JOIN orders o ON oi.order_id = o.id
         ${where}
         GROUP BY c.id, c.name
         ORDER BY revenue DESC`,
        params,
      );
      return rows;
    },

    async getRevenueByBranch({ dateFrom, dateTo } = {}) {
      const params = [];
      let where = `WHERE o.payment_status = 'paid'
                     AND o.id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')`;
      if (dateFrom) {
        params.push(dateFrom);
        where += ` AND o.created_at >= $${params.length}`;
      }
      if (dateTo) {
        params.push(dateTo);
        where += ` AND o.created_at < $${params.length}`;
      }

      const [rows] = await database.query(
        `SELECT s.id, s.name, s.city,
                COALESCE(SUM(o.total), 0)::bigint AS revenue,
                COUNT(o.id)::int AS orders
         FROM stores s
         LEFT JOIN orders o ON o.store_id = s.id AND o.payment_status = 'paid'
           AND o.id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')
         GROUP BY s.id, s.name, s.city
         ORDER BY revenue DESC`,
        params,
      );
      return rows;
    },

    async getTopProducts({ scopedStoreId, limit = 10 } = {}) {
      const params = [];
      let where = `WHERE o.payment_status = 'paid'
                     AND o.id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')`;
      if (scopedStoreId) {
        params.push(scopedStoreId);
        where += ` AND o.store_id = $${params.length}`;
      }
      params.push(limit);

      const [rows] = await database.query(
        `SELECT p.id, p.name, p.image_url, c.name AS category_name,
                COALESCE(SUM(oi.qty), 0)::int AS sold_count,
                COALESCE(SUM(oi.line_total), 0)::bigint AS revenue
         FROM products p
         JOIN categories c ON p.category_id = c.id
         JOIN order_items oi ON oi.product_id = p.id
         JOIN orders o ON oi.order_id = o.id
         ${where}
         GROUP BY p.id, p.name, p.image_url, c.name
         ORDER BY sold_count DESC
         LIMIT $${params.length}`,
        params,
      );
      return rows;
    },

    async getReportsKPISummary({ dateFrom, dateTo, scopedStoreId } = {}) {
      const params = [dateFrom, dateTo];
      let storeCond = '';
      if (scopedStoreId) {
        params.push(scopedStoreId);
        storeCond = ` AND store_id = $${params.length}`;
      }

      const [rev] = await database.query(
        `SELECT COALESCE(SUM(total), 0)::bigint AS v
         FROM orders
         WHERE created_at >= $1 AND created_at < $2
           AND payment_status = 'paid'
           AND id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')
           ${storeCond}`,
        params,
      );

      const [ord] = await database.query(
        `SELECT COUNT(*)::int AS total, COALESCE(AVG(total), 0)::int AS avg
         FROM orders
         WHERE created_at >= $1 AND created_at < $2
           AND payment_status = 'paid'
           AND id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')
           ${storeCond}`,
        params,
      );

      const [cancel] = await database.query(
        `SELECT COUNT(*)::int AS v
         FROM orders o
         WHERE o.created_at >= $1 AND o.created_at < $2
           AND EXISTS (SELECT 1 FROM order_status_history osh WHERE osh.order_id = o.id AND osh.status = 'Đã hủy')
           ${scopedStoreId ? ' AND o.store_id = $3' : ''}`,
        params,
      );

      const [cups] = await database.query(
        `SELECT COALESCE(SUM(oi.qty), 0)::int AS v
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.created_at >= $1 AND o.created_at < $2
           AND o.payment_status = 'paid'
           AND o.id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')
           ${scopedStoreId ? ' AND o.store_id = $3' : ''}`,
        params,
      );

      const totalRevenue = Number(rev[0]?.v || 0);
      const totalOrders = Number(ord[0]?.total || 0);
      const avgOrder = Number(ord[0]?.avg || 0);
      const cancelledOrders = Number(cancel[0]?.v || 0);
      const cupsSold = Number(cups[0]?.v || 0);
      const totalAttempted = totalOrders + cancelledOrders;
      const cancelRate = totalAttempted > 0 ? +((cancelledOrders / totalAttempted) * 100).toFixed(1) : 0;

      return {
        revenue: { value: totalRevenue, change: 0, target: 10000000 },
        orders: { value: totalOrders, change: 0, target: 200 },
        avg_order: { value: avgOrder, change: 0 },
        cancel_rate: { value: cancelRate, change: 0, count: cancelledOrders },
        cups_sold: { value: cupsSold, change: 0 },
      };
    },

    async getReportsSummary({ dateFrom, dateTo, scopedStoreId } = {}) {
      const params = [dateFrom, dateTo];
      let storeCond = '';
      if (scopedStoreId) {
        params.push(scopedStoreId);
        storeCond = ` AND store_id = $${params.length}`;
      }

      const [rev] = await database.query(
        `SELECT COALESCE(SUM(total), 0)::bigint AS v
         FROM orders
         WHERE created_at >= $1 AND created_at < $2
           AND payment_status = 'paid'
           AND id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')
           ${storeCond}`,
        params,
      );

      const [ord] = await database.query(
        `SELECT COUNT(*)::int AS total, COALESCE(AVG(total), 0)::int AS avg
         FROM orders
         WHERE created_at >= $1 AND created_at < $2
           AND payment_status = 'paid'
           AND id NOT IN (SELECT order_id FROM order_status_history WHERE status = 'Đã hủy')
           ${storeCond}`,
        params,
      );

      const [cancel] = await database.query(
        `SELECT COUNT(*)::int AS v
         FROM orders o
         WHERE o.created_at >= $1 AND o.created_at < $2
           AND EXISTS (SELECT 1 FROM order_status_history osh WHERE osh.order_id = o.id AND osh.status = 'Đã hủy')
           ${scopedStoreId ? ' AND o.store_id = $3' : ''}`,
        params,
      );

      return {
        period: { from: dateFrom, to: dateTo },
        revenue: Number(rev[0]?.v || 0),
        total_orders: Number(ord[0]?.total || 0),
        avg_order: Math.round(Number(ord[0]?.avg || 0)),
        cancelled: Number(cancel[0]?.v || 0),
      };
    },
  };
}

export const adminReportsRepository = createAdminReportsRepository();
export default adminReportsRepository;

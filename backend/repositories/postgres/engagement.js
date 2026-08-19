import postgresDb from '../../config/db-postgres.js';

export function createEngagementRepository(database = postgresDb) {
  return {
    async getUserProfile(userId) {
      const [rows] = await database.query(
        'SELECT id, fullname, phone, email, avatar_url, address, tier, points, total_spent, created_at FROM users WHERE id = $1 AND is_admin = FALSE AND is_active = TRUE',
        [userId],
      );
      return rows[0] || null;
    },

    async listUserWishlist(userId) {
      const [rows] = await database.query(
        `SELECT w.id, w.user_id, w.product_id, p.name AS product_name, p.slug AS product_slug, p.price, p.image_url, w.created_at
         FROM wishlists w
         JOIN products p ON p.id = w.product_id
         WHERE w.user_id = $1
         ORDER BY w.created_at DESC`,
        [userId],
      );
      return rows;
    },

    async toggleUserWishlist(userId, productId) {
      const [existing] = await database.query(
        'SELECT id FROM wishlists WHERE user_id = $1 AND product_id = $2',
        [userId, productId],
      );
      if (existing.length) {
        await database.query('DELETE FROM wishlists WHERE id = $1', [existing[0].id]);
        return { added: false };
      }
      await database.query('INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2)', [userId, productId]);
      return { added: true };
    },

    async listUserNotifications(userId) {
      const [rows] = await database.query(
        'SELECT * FROM notifications WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC LIMIT 30',
        [userId],
      );
      return rows;
    },

    async listUserVouchers(userId) {
      const [rows] = await database.query(
        `SELECT uv.*, p.title AS promotion_title, p.rule, p.discount_value, p.discount_type, p.max_discount, p.min_order
         FROM user_vouchers uv
         LEFT JOIN promotions p ON uv.promotion_id = p.id
         WHERE uv.user_id = $1 AND uv.used_at IS NULL AND (uv.expires_at IS NULL OR uv.expires_at >= CURRENT_DATE)
         ORDER BY uv.created_at DESC`,
        [userId],
      );
      return rows;
    },

    async listProductReviews(productId) {
      const [rows] = await database.query(
        `SELECT r.*, u.fullname AS user_name, u.avatar_url AS user_avatar
         FROM reviews r
         LEFT JOIN users u ON u.id = r.user_id
         WHERE r.product_id = $1
         ORDER BY r.created_at DESC`,
        [productId],
      );
      return rows;
    },

    async createProductReview(userId, { productId, orderItemId, rating, comment, imageUrls }) {
      if (orderItemId) {
        const [matched] = await database.query(
          'SELECT 1 FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.id = $1 AND o.user_id = $2',
          [orderItemId, userId],
        );
        if (!matched.length) {
          const err = new Error('Bạn chỉ có thể đánh giá món từ đơn hàng của chính mình');
          err.status = 403;
          throw err;
        }
      }

      await database.query(
        'INSERT INTO reviews (user_id, product_id, order_item_id, rating, comment, image_urls) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, productId, orderItemId || null, comment || null, imageUrls ? JSON.stringify(imageUrls) : null],
      );
      const [stats] = await database.query(
        'SELECT AVG(rating::numeric(2,1)) AS avg_rating, COUNT(*)::int AS cnt FROM reviews WHERE product_id = $1',
        [productId],
      );
      await database.query(
        'UPDATE products SET rating = $1, review_count = $2 WHERE id = $3',
        [stats[0].avg_rating, stats[0].cnt, productId],
      );
      return { message: 'Đánh giá thành công!' };
    },

    async listJobs() {
      const [rows] = await database.query(
        'SELECT * FROM jobs WHERE is_active = TRUE ORDER BY created_at DESC',
      );
      return rows;
    },

    async applyJob({ jobId, storeId, fullname, phone, email, cvUrl }) {
      const [rows] = await database.query(
        'INSERT INTO job_applications (job_id, store_id, fullname, phone, email, cv_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [jobId, storeId || null, fullname, phone, email, cvUrl || null],
      );
      return rows[0];
    },

    async listTiers() {
      const [rows] = await database.query(
        'SELECT * FROM tiers ORDER BY min_points ASC',
      );
      return rows;
    },

    async listRewards() {
      const [rows] = await database.query(
        'SELECT * FROM rewards WHERE is_active = TRUE ORDER BY points_required ASC',
      );
      return rows;
    },
  };
}

export const engagementRepository = createEngagementRepository();
export default engagementRepository;

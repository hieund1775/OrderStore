import postgresDb from '../../config/db-postgres.js';
import { formatVietnamBusinessDate } from '../../services/business-time.js';

export function createEngagementRepository(database = postgresDb, { clock = () => new Date() } = {}) {
  return {
    async getUserProfile(userId) {
      const [rows] = await database.query(
        'SELECT id, fullname, phone, email, avatar_url, address, tier, points, total_spent, created_at FROM users WHERE id = $1 AND is_admin = FALSE AND is_active = TRUE',
        [userId],
      );
      return rows[0] || null;
    },

    async listUserWishlist(userId, storeId = null) {
      const normalizedStoreId = Number(storeId);
      const hasStore = Number.isInteger(normalizedStoreId) && normalizedStoreId > 0;
      const params = [userId];
      let variantLateral = '';
      let priceSelect = 'p.price AS price, p.is_available AS is_available';

      if (hasStore) {
        params.push(normalizedStoreId);
        variantLateral = `
          LEFT JOIN LATERAL (
            SELECT pv.id, pv.sku, pv.name_suffix, pv.variant_signature,
                   bvo.price AS branch_price,
                   (
                     COALESCE(bvo.is_available, FALSE) = TRUE
                     AND bvo.price IS NOT NULL
                     AND bvo.price > 0
                   ) AS is_sellable
            FROM product_variants pv
            LEFT JOIN branch_variant_offers bvo ON bvo.variant_id = pv.id AND bvo.store_id = $2
            WHERE pv.product_id = p.id AND pv.status = 'active'
            ORDER BY
              CASE WHEN (
                COALESCE(bvo.is_available, FALSE) = TRUE
                AND bvo.price IS NOT NULL
                AND bvo.price > 0
              ) THEN 0 ELSE 1 END,
              bvo.price ASC NULLS LAST,
              CASE WHEN pv.variant_signature = 'default' THEN 0 ELSE 1 END,
              pv.id ASC
            LIMIT 1
          ) pv_def ON TRUE
        `;
        priceSelect = `
          pv_def.branch_price AS price,
          (p.is_available = TRUE AND COALESCE(pv_def.is_sellable, FALSE) = TRUE) AS is_available
        `;
      } else {
        variantLateral = `
          LEFT JOIN LATERAL (
            SELECT pv.id, pv.sku, pv.name_suffix, pv.variant_signature,
                   NULL::integer AS branch_price,
                   TRUE AS is_sellable
            FROM product_variants pv
            WHERE pv.product_id = p.id AND pv.status = 'active'
            ORDER BY CASE WHEN pv.variant_signature = 'default' THEN 0 ELSE 1 END, pv.id ASC
            LIMIT 1
          ) pv_def ON TRUE
        `;
      }

      const [rows] = await database.query(
        `SELECT w.id, w.user_id, w.product_id,
                p.name AS product_name, p.slug AS product_slug,
                p.base_tea, p.image_url, p.fulfillment_lane, p.stock_mode,
                pv_def.id AS variant_id, pv_def.sku AS sku, pv_def.name_suffix AS variant_name,
                (
                  p.product_type_schema_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM attribute_definitions ad
                    WHERE ad.schema_id = p.product_type_schema_id
                  )
                ) AS has_options,
                ${priceSelect},
                w.created_at
         FROM wishlists w
         JOIN products p ON p.id = w.product_id
         ${variantLateral}
         WHERE w.user_id = $1 AND p.status = 'active' AND p.is_available = TRUE
         ORDER BY w.created_at DESC, w.id DESC`,
        params,
      );
      return rows;
    },

    async ensureUserWishlistItem(userId, productId, storeId = null) {
      const normalizedStoreId = Number(storeId);
      const hasStore = Number.isInteger(normalizedStoreId) && normalizedStoreId > 0;
      const prodParams = [productId];
      let variantLateral = '';
      let priceSelect = 'p.price AS price, p.is_available AS is_available';

      if (hasStore) {
        prodParams.push(normalizedStoreId);
        variantLateral = `
          LEFT JOIN LATERAL (
            SELECT pv.id, pv.sku, pv.name_suffix, pv.variant_signature,
                   bvo.price AS branch_price,
                   (
                     COALESCE(bvo.is_available, FALSE) = TRUE
                     AND bvo.price IS NOT NULL
                     AND bvo.price > 0
                   ) AS is_sellable
            FROM product_variants pv
            LEFT JOIN branch_variant_offers bvo ON bvo.variant_id = pv.id AND bvo.store_id = $2
            WHERE pv.product_id = p.id AND pv.status = 'active'
            ORDER BY
              CASE WHEN (
                COALESCE(bvo.is_available, FALSE) = TRUE
                AND bvo.price IS NOT NULL
                AND bvo.price > 0
              ) THEN 0 ELSE 1 END,
              bvo.price ASC NULLS LAST,
              CASE WHEN pv.variant_signature = 'default' THEN 0 ELSE 1 END,
              pv.id ASC
            LIMIT 1
          ) pv_def ON TRUE
        `;
        priceSelect = `
          pv_def.branch_price AS price,
          (p.is_available = TRUE AND COALESCE(pv_def.is_sellable, FALSE) = TRUE) AS is_available
        `;
      } else {
        variantLateral = `
          LEFT JOIN LATERAL (
            SELECT pv.id, pv.sku, pv.name_suffix, pv.variant_signature,
                   NULL::integer AS branch_price,
                   TRUE AS is_sellable
            FROM product_variants pv
            WHERE pv.product_id = p.id AND pv.status = 'active'
            ORDER BY CASE WHEN pv.variant_signature = 'default' THEN 0 ELSE 1 END, pv.id ASC
            LIMIT 1
          ) pv_def ON TRUE
        `;
      }

      return await database.transaction(async (tx) => {
        const [productRows] = await tx.query(
          `SELECT p.id, p.name, p.slug, p.base_tea, p.image_url, p.is_available AS product_is_available,
                  p.fulfillment_lane, p.stock_mode,
                  pv_def.id AS variant_id, pv_def.sku AS sku, pv_def.name_suffix AS variant_name,
                  (
                    p.product_type_schema_id IS NOT NULL AND EXISTS (
                      SELECT 1 FROM attribute_definitions ad
                      WHERE ad.schema_id = p.product_type_schema_id
                    )
                  ) AS has_options,
                  ${priceSelect}
           FROM products p
           ${variantLateral}
           WHERE p.id = $1 AND p.status = 'active' FOR SHARE OF p`,
          prodParams,
        );
        if (!productRows || !productRows.length) {
          const err = new Error('Không tìm thấy sản phẩm');
          err.status = 404;
          err.expose = true;
          throw err;
        }
        const product = productRows[0];
        const isGloballyAvailable = product.product_is_available ?? product.is_available;
        if (!isGloballyAvailable) {
          const err = new Error('Sản phẩm hiện đang tạm ngưng phục vụ');
          err.status = 409;
          err.expose = true;
          throw err;
        }

        const [inserted] = await tx.query(
          `INSERT INTO wishlists (user_id, product_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, product_id) DO NOTHING
           RETURNING id, user_id, product_id, created_at`,
          [userId, productId],
        );
        const created = inserted.length > 0;
        let row = inserted[0];
        if (!row) {
          const [existing] = await tx.query(
            'SELECT id, user_id, product_id, created_at FROM wishlists WHERE user_id = $1 AND product_id = $2',
            [userId, productId],
          );
          row = existing[0];
        }
        if (!row) {
          throw new Error('Wishlist insert completed without a persisted row');
        }
        return {
          created,
          item: {
            id: row.id,
            user_id: row.user_id,
            product_id: row.product_id,
            product_name: product.name,
            product_slug: product.slug,
            base_tea: product.base_tea,
            price: product.price,
            image_url: product.image_url,
            is_available: product.is_available,
            has_options: product.has_options,
            sku: product.sku,
            variant_id: product.variant_id,
            variant_name: product.variant_name,
            fulfillment_lane: product.fulfillment_lane,
            stock_mode: product.stock_mode,
            created_at: row.created_at,
          },
        };
      });
    },

    async removeUserWishlistItem(userId, productId) {
      const [result] = await database.query(
        'DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2 RETURNING id',
        [userId, productId],
      );
      return { removed: Boolean(result && result.length > 0) };
    },

    async listUserNotifications(userId) {
      const [rows] = await database.query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
        [userId],
      );
      return rows;
    },

    async listUserVouchers(userId) {
      const businessDate = formatVietnamBusinessDate(clock());
      const [rows] = await database.query(
        `SELECT uv.*, p.title AS promotion_title, p.rule, p.discount_value, p.discount_type, p.max_discount, p.min_order
         FROM user_vouchers uv
         LEFT JOIN promotions p ON uv.promotion_id = p.id
         WHERE uv.user_id = $1 AND uv.used_at IS NULL AND (uv.expires_at IS NULL OR uv.expires_at >= $2)
         ORDER BY uv.created_at DESC`,
        [userId, businessDate],
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
        'SELECT * FROM tier_rules ORDER BY min_points ASC',
      );
      return rows;
    },

    async listRewards() {
      const [rows] = await database.query(
        'SELECT * FROM rewards WHERE is_active = TRUE ORDER BY points_cost ASC',
      );
      return rows;
    },
  };
}

export const engagementRepository = createEngagementRepository();
export default engagementRepository;

import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import postgresDb from '../config/db-postgres.js';
import { JWT_SECRET } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { isPayOSConfigured } from '../services/payos.js';
import { validateOrderCreationInput, buildPublicLookupDto } from '../services/public-dto.js';
import { evaluateOrderTransition } from '../services/order-transition-policy.js';
import { decodeCursor, validatePaginationLimit, buildPageInfo } from '../services/cursor-pagination.js';
import { batchLoadPostgresOrderDetails } from '../services/order-batch-loader.js';
import catalogRepository from '../repositories/postgres/catalog.js';
import storesRepository from '../repositories/postgres/stores.js';
import { createOnlinePayOSOrder } from '../services/online-payos-order.js';
import promotionsRepository from '../repositories/postgres/promotions.js';
import ordersRepository from '../repositories/postgres/orders.js';
import { hashOrderRequest } from '../services/order-idempotency.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { orderErrorStatus } from '../services/orders/order-errors.js';
import customerOrderService from '../services/orders/customer-order-service.js';
import { toCustomerOrderListItemDto } from '../dto/order-dto.js';
import publicOrdersRouter, { handleCustomerCancelOrder } from './public/orders.js';
import publicCatalogRouter from './public/catalog.js';
import publicStoresRouter from './public/stores.js';
import publicPromotionsRouter from './public/promotions.js';
import { validateCreateOrderInput, validateOrderId, validateOrderMutationInput, validateOrderReference } from '../validation/order-schemas.js';

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Products]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Server is running
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'TeaPlus API (PostgreSQL)', timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: Danh sách sản phẩm
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Slug danh mục
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Tìm theo tên hoặc mô tả
 *       - in: query
 *         name: tag
 *         schema: { type: string }
 *         description: Lọc theo tag (best-seller, new, seasonal)
 */

// ═══════════ CATALOG, STORES & PROMOTIONS DOMAINS ═══════════
router.use('/', publicCatalogRouter);
router.use('/', publicStoresRouter);
router.use('/', publicPromotionsRouter);

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     tags: [Jobs]
 *     summary: Danh sách tin tuyển dụng
 *     responses: { 200: { description: OK } }
 * /api/jobs/{id}/apply:
 *   post:
 *     tags: [Jobs]
 *     summary: Nộp đơn ứng tuyển
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullname, phone, email]
 *             properties:
 *               fullname: { type: string }
 *               phone: { type: string }
 *               email: { type: string }
 *               store_id: { type: integer }
 *               cv_url: { type: string }
 *     responses: { 201: { description: OK } }
 */
router.get('/jobs', async (req, res) => {
  try { res.json(await catalogRepository.listJobs()); }
  catch (err) { console.error('Public jobs read failed:', err.message); res.status(500).json({ error: 'Không thể tải tuyển dụng lúc này' }); }
});
router.post('/jobs/:id/apply', async (req, res) => {
  try {
    const { fullname, phone, email, store_id, cv_url } = req.body;
    const [r] = await postgresDb.query(
      'INSERT INTO job_applications (job_id, store_id, fullname, phone, email, cv_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [req.params.id, store_id || null, fullname, phone, email, cv_url || null],
    );
    res.status(201).json({ id: r[0].id, message: 'Nộp hồ sơ thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
/**
 * @swagger
 * /api/tiers:
 *   get:
 *     tags: [Tiers & Rewards]
 *     summary: Danh sách hạng hội viên
 *     responses: { 200: { description: OK } }
 * /api/rewards:
 *   get:
 *     tags: [Tiers & Rewards]
 *     summary: Danh sách quà đổi thưởng
 *     responses: { 200: { description: OK } }
 */
router.get('/tiers', async (req, res) => {
  try { res.json(await catalogRepository.listTiers()); }
  catch (err) { console.error('Public tiers read failed:', err.message); res.status(500).json({ error: 'Không thể tải hạng thành viên lúc này' }); }
});
router.get('/rewards', async (req, res) => {
  try { res.json(await catalogRepository.listRewards()); }
  catch (err) { console.error('Public rewards read failed:', err.message); res.status(500).json({ error: 'Không thể tải quà đổi thưởng lúc này' }); }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Thông tin khách hàng
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses: { 200: { description: OK }, 404: { description: Not found } }
 * /api/users/{id}/orders:
 *   get:
 *     tags: [Users]
 *     summary: Lịch sử đơn hàng
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses: { 200: { description: OK } }
 * /api/users/{id}/wishlist:
 *   get:
 *     tags: [Users]
 *     summary: Danh sách yêu thích
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [Users]
 *     summary: Toggle wishlist (thêm/xóa)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: integer }
 *     responses: { 200: { description: OK }, 201: { description: Created } }
 * /api/users/{id}/notifications:
 *   get:
 *     tags: [Users]
 *     summary: Thông báo của user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses: { 200: { description: OK } }
 * /api/users/{id}/vouchers:
 *   get:
 *     tags: [Users]
 *     summary: Voucher trong ví
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses: { 200: { description: OK } }
 * /api/products/{id}/reviews:
 *   get:
 *     tags: [Reviews]
 *     summary: Đánh giá sản phẩm
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [Reviews]
 *     summary: Gửi đánh giá
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, rating]
 *             properties:
 *               user_id: { type: integer }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string }
 *               order_item_id: { type: integer }
 *     responses: { 201: { description: OK } }
 * /api/search/suggestions:
 *   get:
 *     tags: [Search]
 *     summary: Gợi ý tìm kiếm
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses: { 200: { description: OK } }
 */
function requireCustomerSelf(req, res, next) {
  const requestedId = Number(req.params.id);
  const authUserId = Number(req.user?.id || req.user?.sub);
  if (!authUserId) {
    return res.status(401).json({ error: 'Chưa xác thực người dùng' });
  }
  if (requestedId !== authUserId && req.user?.role !== 'super') {
    return res.status(403).json({ error: 'Không có quyền truy cập dữ liệu của người dùng khác' });
  }
  next();
}

router.get('/users/:id', authenticate, requireCustomerSelf, async (req, res) => {
  try {
    const [rows] = await postgresDb.query(
      'SELECT id, fullname, phone, email, avatar_url, address, tier, points, total_spent, created_at FROM users WHERE id = $1 AND is_admin = FALSE AND is_active = TRUE',
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id/orders', authenticate, requireCustomerSelf, asyncHandler(async (req, res) => {
  try {
    const requestedId = validateOrderId(req.params.id);
    const limit = validatePaginationLimit(req.query.limit, 50, 100);
    const cursor = decodeCursor(req.query.cursor);
    const paginated = req.query.cursor !== undefined || req.query.limit !== undefined;
    const result = await customerOrderService.listCustomerHistory({
      userId: requestedId,
      limit,
      cursor,
      paginated,
    });
    if (Array.isArray(result)) {
      return res.json(result.map(toCustomerOrderListItemDto));
    }
    res.json({
      ...result,
      orders: result.orders.map(toCustomerOrderListItemDto),
    });
  } catch (err) {
    const status = orderErrorStatus(err);
    res.status(status).json({ error: err.message });
  }
}));

router.get('/users/:id/wishlist', authenticate, requireCustomerSelf, async (req, res) => {
  try {
    res.json(await catalogRepository.listWishlist(req.params.id));
  } catch (err) { console.error('Public wishlist read failed:', err.message); res.status(500).json({ error: 'Không thể tải danh sách yêu thích lúc này' }); }
});

router.post('/users/:id/wishlist/:productId', authenticate, requireCustomerSelf, async (req, res) => {
  try {
    const { id, productId } = req.params;
    const [existing] = await postgresDb.query('SELECT id FROM wishlists WHERE user_id = $1 AND product_id = $2', [id, productId]);
    if (existing.length) {
      await postgresDb.query('DELETE FROM wishlists WHERE id = $1', [existing[0].id]);
      res.json({ added: false, message: 'Đã xóa khỏi wishlist' });
    } else {
      await postgresDb.query('INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2)', [id, productId]);
      res.status(201).json({ added: true, message: 'Đã thêm vào wishlist' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id/notifications', authenticate, requireCustomerSelf, async (req, res) => {
  try {
    const [r] = await postgresDb.query('SELECT * FROM notifications WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC LIMIT 30', [req.params.id]);
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id/vouchers', authenticate, requireCustomerSelf, async (req, res) => {
  try {
    const [r] = await postgresDb.query(`
      SELECT uv.*, p.title AS promotion_title, p.rule, p.discount_value, p.discount_type, p.max_discount, p.min_order
      FROM user_vouchers uv LEFT JOIN promotions p ON uv.promotion_id = p.id
      WHERE uv.user_id = $1 AND uv.used_at IS NULL AND (uv.expires_at IS NULL OR uv.expires_at >= CURRENT_DATE)
      ORDER BY uv.created_at DESC
    `, [req.params.id]);
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/products/:id/reviews', async (req, res) => {
  try {
    res.json(await catalogRepository.listProductReviews(req.params.id));
  } catch (err) { console.error('Public reviews read failed:', err.message); res.status(500).json({ error: 'Không thể tải đánh giá lúc này' }); }
});

router.post('/products/:id/reviews', authenticate, async (req, res) => {
  try {
    const userId = Number(req.user?.id || req.user?.sub);
    const { order_item_id, rating, comment, image_urls } = req.body;
    if (!rating) return res.status(400).json({ error: 'Thiếu rating đánh giá' });

    if (order_item_id) {
      const [matched] = await postgresDb.query(
        'SELECT 1 FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.id = $1 AND o.user_id = $2',
        [order_item_id, userId],
      );
      if (!matched.length) {
        return res.status(403).json({ error: 'Bạn chỉ có thể đánh giá món từ đơn hàng của chính mình' });
      }
    }

    await postgresDb.query(
      'INSERT INTO reviews (user_id, product_id, order_item_id, rating, comment, image_urls) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, req.params.id, order_item_id || null, comment || null, image_urls ? JSON.stringify(image_urls) : null],
    );
    const [stats] = await postgresDb.query('SELECT AVG(rating::numeric(2,1)) AS avg_rating, COUNT(*)::int AS cnt FROM reviews WHERE product_id = $1', [req.params.id]);
    await postgresDb.query('UPDATE products SET rating = $1, review_count = $2 WHERE id = $3', [stats[0].avg_rating, stats[0].cnt, req.params.id]);
    res.status(201).json({ message: 'Đánh giá thành công!' });
  } catch (err) {
    if (err.message && err.message.includes('uq_review')) return res.status(409).json({ error: 'Bạn đã đánh giá món này rồi' });
    res.status(500).json({ error: err.message });
  }
});

// ═══════════ ORDERS DOMAIN ═══════════
router.use('/orders', publicOrdersRouter);
export { handleCustomerCancelOrder };

export default router;

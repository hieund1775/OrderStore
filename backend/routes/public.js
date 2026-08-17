import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { JWT_SECRET } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { ScopeError } from '../middleware/branch-scope.js';
import { calcLineTotals, validateVoucher, consumeVoucher, generateOrderCode } from '../services/price-engine.js';
import { createPaymentLinkForOrder, isPayOSConfigured } from '../services/payos.js';
import { validateOrderCreationInput, buildPublicLookupDto } from '../services/public-dto.js';
import { evaluateOrderTransition } from '../services/order-transition-policy.js';
import { decodeCursor, validatePaginationLimit, buildPageInfo } from '../services/cursor-pagination.js';
import { batchLoadOrderDetails } from '../services/order-batch-loader.js';
import catalogRepository from '../repositories/postgres/catalog.js';
import storesRepository from '../repositories/postgres/stores.js';
import { createOnlinePayOSOrder } from '../services/online-payos-order.js';
import promotionsRepository from '../repositories/postgres/promotions.js';

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
  res.json({ status: 'ok', message: 'TeaPlus API (SQL Server)', timestamp: new Date().toISOString() });
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
 *     responses:
 *       200:
 *         description: Danh sách sản phẩm
 */
router.get('/products', async (req, res) => {
  try {
    res.json(await catalogRepository.listProducts(req.query));
  } catch (err) { console.error('Public products read failed:', err.message); res.status(500).json({ error: 'Không thể tải sản phẩm lúc này' }); }
});

/**
 * @swagger
 * /api/products/{slug}:
 *   get:
 *     tags: [Products]
 *     summary: Chi tiết sản phẩm
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Chi tiết sản phẩm
 *       404:
 *         description: Không tìm thấy
 */
router.get('/products/:slug', async (req, res) => {
  try {
    const product = await catalogRepository.findProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    res.json(product);
  } catch (err) { console.error('Public product detail failed:', err.message); res.status(500).json({ error: 'Không thể tải sản phẩm lúc này' }); }
});

/**
 * @swagger
 * /api/categories:
 *   get:
 *     tags: [Categories]
 *     summary: Danh sách danh mục
 *     responses:
 *       200:
 *         description: Danh sách danh mục
 */
router.get('/categories', async (req, res) => {
  try { res.json(await catalogRepository.listCategories()); }
  catch (err) { console.error('Public categories read failed:', err.message); res.status(500).json({ error: 'Không thể tải danh mục lúc này' }); }
});

/**
 * @swagger
 * /api/options/sizes:
 *   get:
 *     tags: [Options]
 *     summary: Tùy chọn kích cỡ
 *     responses: { 200: { description: OK } }
 * /api/options/bases:
 *   get:
 *     tags: [Options]
 *     summary: Tùy chọn cốt trà
 *     responses: { 200: { description: OK } }
 * /api/options/sugars:
 *   get:
 *     tags: [Options]
 *     summary: Tùy chọn mức đường
 *     responses: { 200: { description: OK } }
 * /api/options/ices:
 *   get:
 *     tags: [Options]
 *     summary: Tùy chọn mức đá
 *     responses: { 200: { description: OK } }
 * /api/options/toppings:
 *   get:
 *     tags: [Options]
 *     summary: Danh sách topping
 *     responses: { 200: { description: OK } }
 */
for (const optionKind of ['sizes', 'bases', 'sugars', 'ices', 'toppings']) {
  router.get(`/options/${optionKind}`, async (req, res) => {
    try { res.json(await catalogRepository.listOptions(optionKind)); }
    catch (err) { console.error(`Public ${optionKind} options read failed:`, err.message); res.status(500).json({ error: 'Không thể tải tùy chọn lúc này' }); }
  });
}

/**
 * @swagger
 * /api/stores:
 *   get:
 *     tags: [Stores]
 *     summary: Danh sách chi nhánh
 *     parameters:
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: district
 *         schema: { type: string }
 *     responses: { 200: { description: OK } }
 * /api/stores/districts:
 *   get:
 *     tags: [Stores]
 *     summary: Danh sách thành phố / quận
 *     responses: { 200: { description: OK } }
 */
router.get('/stores', async (req, res) => {
  try {
    res.json(await storesRepository.listActiveStores(req.query));
  } catch (err) { console.error('Public stores read failed:', err.message); res.status(500).json({ error: 'Không thể tải cửa hàng lúc này' }); }
});
router.get('/stores/districts', async (req, res) => {
  try { res.json(await storesRepository.listActiveDistricts()); }
  catch (err) { console.error('Public store districts read failed:', err.message); res.status(500).json({ error: 'Không thể tải khu vực lúc này' }); }
});

/**
 * @swagger
 * /api/promotions:
 *   get:
 *     tags: [Promotions]
 *     summary: Danh sách khuyến mãi
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Lọc theo trạng thái
 *     responses: { 200: { description: OK } }
 */
router.get('/promotions', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM promotions WHERE is_active = 1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY start_date DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
    const [r] = await db.query(
      'INSERT INTO job_applications (job_id, store_id, fullname, phone, email, cv_url) OUTPUT INSERTED.id VALUES (?,?,?,?,?,?)',
      [req.params.id, store_id || null, fullname, phone, email, cv_url || null]
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
    const [rows] = await db.query(
      'SELECT id, fullname, phone, email, avatar_url, address, tier, points, total_spent, created_at FROM users WHERE id = ? AND is_admin = 0 AND is_active = 1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id/orders', authenticate, requireCustomerSelf, async (req, res) => {
  try {
    const requestedId = Number(req.params.id);
    const limit = validatePaginationLimit(req.query.limit, 50, 100);
    const cursor = decodeCursor(req.query.cursor);

    let sql = `
      SELECT TOP (?)
        o.id, o.order_code, o.user_id, o.store_id, o.table_id, o.location_name,
        o.order_type, o.payment_method, o.payment_status, o.payment_provider,
        o.customer_name, o.customer_phone, o.delivery_addr, o.voucher_code,
        o.discount_amount, o.subtotal, o.total, o.note, o.created_at, o.updated_at,
        s.name AS store_name,
        (SELECT TOP 1 osh.status FROM order_status_history osh WHERE osh.order_id = o.id ORDER BY osh.created_at DESC, osh.id DESC) AS current_status
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      WHERE o.user_id = ?
    `;
    const params = [limit + 1, requestedId];

    if (cursor) {
      sql += ' AND (o.created_at < ? OR (o.created_at = ? AND o.id < ?))';
      params.push(cursor.createdAtIso, cursor.createdAtIso, cursor.id);
    }

    sql += ' ORDER BY o.created_at DESC, o.id DESC';

    const [rows] = await db.query(sql, params);

    const { rows: pagedOrders, page_info } = buildPageInfo({ rows, limit });

    // Batch load all items and toppings in 2 single queries instead of N loop queries
    await batchLoadOrderDetails(pagedOrders, db.query);

    if (req.query.cursor !== undefined || req.query.limit !== undefined) {
      return res.json({ orders: pagedOrders, page_info });
    }

    res.json(pagedOrders);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/users/:id/wishlist', authenticate, requireCustomerSelf, async (req, res) => {
  try {
    res.json(await catalogRepository.listWishlist(req.params.id));
  } catch (err) { console.error('Public wishlist read failed:', err.message); res.status(500).json({ error: 'Không thể tải danh sách yêu thích lúc này' }); }
});

router.post('/users/:id/wishlist/:productId', authenticate, requireCustomerSelf, async (req, res) => {
  try {
    const { id, productId } = req.params;
    const [existing] = await db.query('SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?', [id, productId]);
    if (existing.length) {
      await db.query('DELETE FROM wishlists WHERE id = ?', [existing[0].id]);
      res.json({ added: false, message: 'Đã xóa khỏi wishlist' });
    } else {
      await db.query('INSERT INTO wishlists (user_id, product_id) VALUES (?,?)', [id, productId]);
      res.status(201).json({ added: true, message: 'Đã thêm vào wishlist' });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id/notifications', authenticate, requireCustomerSelf, async (req, res) => {
  try {
    const [r] = await db.query('SELECT TOP 30 * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC', [req.params.id]);
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id/vouchers', authenticate, requireCustomerSelf, async (req, res) => {
  try {
    const [r] = await db.query(`
      SELECT uv.*, p.title AS promotion_title, p.[rule], p.discount_value, p.discount_type, p.max_discount, p.min_order
      FROM user_vouchers uv LEFT JOIN promotions p ON uv.promotion_id = p.id
      WHERE uv.user_id = ? AND uv.used_at IS NULL AND (uv.expires_at IS NULL OR uv.expires_at >= CAST(GETDATE() AS DATE))
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
      const [matched] = await db.query(
        'SELECT 1 FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.id = ? AND o.user_id = ?',
        [order_item_id, userId]
      );
      if (!matched.length) {
        return res.status(403).json({ error: 'Bạn chỉ có thể đánh giá món từ đơn hàng của chính mình' });
      }
    }

    await db.query(
      'INSERT INTO reviews (user_id, product_id, order_item_id, rating, comment, image_urls) VALUES (?,?,?,?,?,?)',
      [userId, req.params.id, order_item_id || null, rating, comment || null, image_urls ? JSON.stringify(image_urls) : null]
    );
    const [stats] = await db.query('SELECT AVG(CAST(rating AS DECIMAL(2,1))) AS avg_rating, COUNT(*) AS cnt FROM reviews WHERE product_id = ?', [req.params.id]);
    await db.query('UPDATE products SET rating = ?, review_count = ? WHERE id = ?', [stats[0].avg_rating, stats[0].cnt, req.params.id]);
    res.status(201).json({ message: 'Đánh giá thành công!' });
  } catch (err) {
    if (err.message && err.message.includes('UQ_review')) return res.status(409).json({ error: 'Bạn đã đánh giá món này rồi' });
    res.status(500).json({ error: err.message });
  }
});


router.get('/search/suggestions', async (req, res) => {
  try {
    res.json(await catalogRepository.listSearchSuggestions(req.query.q));
  } catch (err) { console.error('Public search suggestions read failed:', err.message); res.status(500).json({ error: 'Không thể tải gợi ý tìm kiếm lúc này' }); }
});

// ═══════════ ORDER LOOKUP (mã đơn / QR bill) ═══════════
router.get('/orders/lookup', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Thiếu mã đơn' });
    const [rows] = await db.query(
      `SELECT o.id, o.order_code, o.user_id, o.store_id, o.location_name,
              o.order_type, o.payment_method, o.payment_status,
              o.customer_name, o.customer_phone, o.delivery_addr,
              o.discount_amount, o.subtotal, o.total,
              o.payment_expires_at, o.created_at,
              s.name AS store_name,
              (SELECT TOP 1 osh.status FROM order_status_history osh WHERE osh.order_id = o.id ORDER BY osh.created_at DESC, osh.id DESC) AS current_status
       FROM orders o JOIN stores s ON o.store_id = s.id WHERE o.order_code = ?`,
      [code],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    const order = rows[0];

    let decodedToken = null;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded?.role === 'customer') {
          decodedToken = decoded;
        }
      } catch {}
    }

    const [items] = await db.query(
      `SELECT oi.product_name, oi.qty, oi.size_label,
              oi.base_tea, oi.sugar_level, oi.ice_level, oi.note, oi.unit_price, oi.line_total,
              (SELECT topping_name AS name, topping_price AS price FROM order_item_toppings WHERE order_item_id = oi.id FOR JSON PATH) AS toppings
       FROM order_items oi WHERE oi.order_id = ?`,
      [order.id],
    );
    const mappedItems = items.map((i) => {
      let t = [];
      try { t = JSON.parse(i.toppings || '[]'); } catch {}
      return {
        product_name: i.product_name,
        qty: i.qty,
        size_label: i.size_label,
        base_tea: i.base_tea,
        sugar_level: i.sugar_level,
        ice_level: i.ice_level,
        note: i.note,
        unit_price: i.unit_price,
        line_total: i.line_total,
        toppings: t,
      };
    });

    const [history] = await db.query(
      'SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC, id ASC',
      [order.id],
    );

    const safeOrder = buildPublicLookupDto(order, decodedToken, mappedItems, history);

    res.json({ order: safeOrder });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════ CANCEL ORDER (khách tự hủy — timingSafeEqual & atomic) ═══════════
export const handleCustomerCancelOrder = async (req, res) => {
  try {
    const { reason, cancel_token } = req.body || {};
    const orderIdentifier = req.params.id || req.body?.order_id || req.body?.order_code;
    const rawCancelToken = (req.headers['x-cancel-token'] || cancel_token || '').trim();

    // 1) Verify customer JWT identity if logged in
    let authUserId = null;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded?.role === 'customer') {
          authUserId = Number(decoded.id || decoded.sub);
        }
      } catch {}
    }

    const result = await db.transaction(async (tx) => {
      const isNumericId = !Number.isNaN(Number(orderIdentifier));
      const sql = isNumericId
        ? 'SELECT id, order_code, user_id, payment_status, cancel_token_hash FROM orders WITH (UPDLOCK, ROWLOCK, HOLDLOCK) WHERE id = ?'
        : 'SELECT id, order_code, user_id, payment_status, cancel_token_hash FROM orders WITH (UPDLOCK, ROWLOCK, HOLDLOCK) WHERE order_code = ?';
      const [rows] = await tx.query(sql, [orderIdentifier]);
      if (rows.length === 0) throw new ScopeError('Không tìm thấy đơn hàng', 404);

      const order = rows[0];

      // Check ownership or guest cancel token
      if (order.user_id) {
        if (!authUserId || authUserId !== order.user_id) {
          throw new ScopeError('Bạn không có quyền hủy đơn hàng này', 403);
        }
      } else {
        // Guest order: must provide valid cancel token matching cancel_token_hash
        if (!rawCancelToken) {
          throw new ScopeError('Thiếu mã hủy đơn (cancellation token)', 403);
        }
        const providedHash = crypto.createHash('sha256').update(rawCancelToken).digest();
        const storedHash = Buffer.from(String(order.cancel_token_hash || '').trim(), 'hex');
        if (providedHash.length !== storedHash.length || !crypto.timingSafeEqual(providedHash, storedHash)) {
          throw new ScopeError('Mã hủy đơn không chính xác hoặc không hợp lệ', 403);
        }
      }

      const [cur] = await tx.query(
        'SELECT TOP 1 status FROM order_status_history WITH (UPDLOCK, ROWLOCK, HOLDLOCK) WHERE order_id = ? ORDER BY created_at DESC, id DESC',
        [order.id],
      );
      const currentStatus = cur[0]?.status || 'Chờ xác nhận';

      const transition = evaluateOrderTransition({
        currentStatus,
        targetStatus: 'Đã hủy',
        role: 'customer',
        isPaid: order.payment_status === 'paid',
      });

      if (!transition.allowed) {
        throw new ScopeError(transition.error, transition.status || 400);
      }

      if (transition.idempotent) {
        return { order_id: order.id, order_code: order.order_code, status: 'Đã hủy', already_cancelled: true };
      }

      await tx.query(
        "INSERT INTO order_status_history (order_id, status, note, created_at) VALUES (?, N'Đã hủy', ?, GETDATE())",
        [order.id, reason || 'Khách yêu cầu hủy đơn'],
      );
      await tx.query('UPDATE orders SET cancel_reason = ?, updated_at = GETDATE() WHERE id = ?', [reason || 'Khách yêu cầu hủy đơn', order.id]);
      return { order_id: order.id, order_code: order.order_code, status: 'Đã hủy' };
    });

    res.json({ ...result, message: 'Đã hủy đơn hàng thành công' });
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
};

router.post('/orders/:id/cancel', handleCustomerCancelOrder);
router.post('/orders/cancel', handleCustomerCancelOrder);

// ═══════════ TABLE RESOLVE (QR) ═══════════
router.get('/table/resolve', async (req, res) => {
  try {
    const { table_id } = req.query;
    if (!table_id) return res.status(400).json({ error: 'Thiếu table_id' });
    const [rows] = await db.query(
      `SELECT t.id, t.name, t.store_id, s.name AS store_name, s.address AS store_address
       FROM tables t JOIN stores s ON s.id = t.store_id
       WHERE t.id = ? AND t.is_active = 1`,
      [table_id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy bàn hoặc bàn đã ngưng hoạt động' });
    res.json({ table: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════ VOUCHER APPLY ═══════════
router.post('/vouchers/apply', async (req, res) => {
  try {
    const { code, subtotal, customer_phone, store_id } = req.body;
    if (!code) return res.status(400).json({ valid: false, message: 'Thiếu mã voucher' });
    const { discount_amount } = await promotionsRepository.preview({
      code,
      subtotal: Number(subtotal) || 0,
      phone: customer_phone || '',
      storeId: Number(store_id),
    });
    res.json({ valid: true, discount_amount, code, message: 'Áp dụng thành công' });
  } catch (err) {
    res.status(400).json({ valid: false, message: err.message });
  }
});

// ═══════════ CREATE ORDER (Zero-Trust Price Engine) ═══════════
router.post('/orders', async (req, res) => {
  try {
    const {
      store_id, table_id, order_type = 'Take-away', payment_method = 'VietQR',
      customer_name, customer_phone, delivery_addr = null,
      voucher_code = null, note = null, items = [], source = 'online',
      return_url, cancel_url,
    } = req.body;

    // Validate allowed source, payment_method, order_type via production validator
    const inputValidation = validateOrderCreationInput(req.body);
    if (!inputValidation.valid) {
      return res.status(400).json({ error: inputValidation.error });
    }

    if (source === 'online' && payment_method === 'VietQR') {
      if (!isPayOSConfigured()) {
        return res.status(400).json({ error: 'Cổng thanh toán trực tuyến PayOS chưa được kích hoạt trên hệ thống' });
      }
      const idempotencyKey = String(req.headers['idempotency-key'] || '');
      const payosOrder = await createOnlinePayOSOrder({
        input: req.body,
        userId: null,
        idempotencyKey,
      });
      return res.status(payosOrder.replay ? 200 : 201).json({ ...payosOrder, status: 'Đang chuẩn bị' });
    }

    const normalizedSource = source || 'online';
    const normalizedOrderType = order_type || 'Take-away';
    const normalizedPaymentMethod = payment_method || 'VietQR';

    if (!store_id || !customer_name || !customer_phone || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Thiếu thông tin đơn hàng bắt buộc (store_id, tên, SĐT, danh sách món)' });
    }

    if (normalizedOrderType === 'Delivery' && (!delivery_addr || !delivery_addr.trim())) {
      return res.status(400).json({ error: 'Đơn hàng Giao tận nơi bắt buộc phải nhập địa chỉ giao hàng' });
    }

    // Determine initial payment_status & payment_provider based on source and method
    const payment_status = 'unpaid';
    let payment_provider = 'cod';

    if (normalizedSource === 'pos') {
      if (normalizedPaymentMethod === 'VietQR') {
        payment_provider = 'manual_vietqr';
      } else if (normalizedPaymentMethod === 'COD') {
        payment_provider = 'cod';
      } else {
        payment_provider = normalizedPaymentMethod.toLowerCase();
      }
    } else {
      // source === 'online'
      if (normalizedPaymentMethod === 'VietQR') {
        if (isPayOSConfigured()) {
          payment_provider = 'payos';
        } else {
          return res.status(400).json({ error: 'Cổng thanh toán trực tuyến PayOS chưa được kích hoạt trên hệ thống' });
        }
      } else if (normalizedPaymentMethod === 'COD') {
        payment_provider = 'cod';
      } else {
        payment_provider = normalizedPaymentMethod.toLowerCase();
      }
    }

    // Trích xuất customer user_id từ JWT Token nếu có (BẮT BUỘC role === 'customer')
    let customerUserId = null;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.role === 'customer' && (decoded.id || decoded.sub)) {
          customerUserId = Number(decoded.id || decoded.sub);
        }
      } catch {}
    }

    // Generate guest cancellation token if guest order
    let rawCancelToken = null;
    let cancelTokenHash = null;
    if (!customerUserId && normalizedSource === 'online') {
      rawCancelToken = crypto.randomBytes(32).toString('hex');
      cancelTokenHash = crypto.createHash('sha256').update(rawCancelToken).digest('hex');
    }

    const result = await db.transaction(async (tx) => {
      // 0) Validate table belongs to store and is active
      let location_name = null;
      if (table_id) {
        const [tables] = await tx.query('SELECT id, name, store_id, is_active FROM tables WHERE id = ? AND store_id = ? AND is_active = 1', [table_id, store_id]);
        if (!tables.length) {
          throw new Error('Bàn không tồn tại, không thuộc chi nhánh đã chọn hoặc đã ngưng hoạt động');
        }
        location_name = tables[0].name;
      }

      // 1) Tính giá 100% từ DB — bỏ qua mọi giá client gửi lên
      const lines = [];
      let subtotal = 0;
      for (const item of items) {
        const line = await calcLineTotals(item, tx.query);
        lines.push({ ...item, ...line });
        subtotal += line.line_total;
      }

      // 2) Validate + tiêu hao voucher (atomic, chống race condition)
      const { discount_amount, promotion_id } = await validateVoucher(
        { code: voucher_code, subtotal, customer_phone },
        tx.query,
      );
      if (promotion_id) {
        const ok = await consumeVoucher(promotion_id, tx.query);
        if (!ok) throw new Error('Voucher đã hết lượt sử dụng');
      }

      const total = Math.max(0, subtotal - discount_amount);

      // 3) Tạo đơn
      const order_code = await generateOrderCode(tx.query);
      const [orderRows] = await tx.query(
        `INSERT INTO orders (order_code, user_id, store_id, table_id, location_name,
           order_type, payment_method, payment_status, payment_provider, cancel_token_hash, customer_name, customer_phone, delivery_addr,
           voucher_code, discount_amount, points_used, points_earned, subtotal, total,
           is_printed, kitchen_notified_at, note, created_at, updated_at)
         OUTPUT INSERTED.id
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?, GETDATE(), GETDATE())`,
        [order_code, customerUserId, store_id, table_id || null, location_name,
         normalizedOrderType, normalizedPaymentMethod, payment_status, payment_provider, cancelTokenHash, customer_name, customer_phone, delivery_addr,
         voucher_code, discount_amount, Math.floor(total / 1000), subtotal, total,
         new Date(), note || null],
      );
      const orderId = orderRows[0].id;

      // 4) Món + Topping
      for (const line of lines) {
        const product_name = line.product_name || `Món #${line.product_id}`;
        const [itemRows] = await tx.query(
          `INSERT INTO order_items (order_id, product_id, product_name, qty, size_label,
             base_tea, sugar_level, ice_level, note, unit_price, line_total)
           OUTPUT INSERTED.id
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderId, line.product_id, product_name, line.qty,
           line.size_label || 'M', line.base_tea || '', line.sugar_level || '', line.ice_level || '',
           line.note || null, line.unit_price, line.line_total],
        );
        const itemId = itemRows[0].id;
        for (const t of line.toppings) {
          await tx.query(
            'INSERT INTO order_item_toppings (order_item_id, topping_name, topping_price) VALUES (?, ?, ?)',
            [itemId, t.name, t.price],
          );
        }
      }

      // 5) Lịch sử trạng thái ban đầu
      await tx.query(
        `INSERT INTO order_status_history (order_id, status, note, changed_by, created_at)
         VALUES (?, N'Đang chuẩn bị', NULL, NULL, GETDATE())`,
        [orderId],
      );

      // 6) Ghi lịch sử dùng mã 1 lần
      if (promotion_id && voucher_code) {
        await tx.query(
          'INSERT INTO voucher_usage_history (promotion_id, user_phone, order_id, used_at) VALUES (?, ?, ?, GETDATE())',
          [promotion_id, customer_phone, orderId],
        );
      }

      const resObj = { order_id: orderId, order_code, subtotal, discount_amount, total, payment_status, payment_provider };
      if (rawCancelToken) resObj.cancel_token = rawCancelToken;
      return resObj;
    });

    // PayOS payment link creation after DB transaction commit (only for online payos)
    if (normalizedSource === 'online' && payment_provider === 'payos' && isPayOSConfigured()) {
      try {
        const payosResult = await createPaymentLinkForOrder({
          orderId: result.order_id,
          orderCode: result.order_code,
          total: result.total,
          returnUrl: return_url,
          cancelUrl: cancel_url,
        });

        await db.query(
          `UPDATE orders
           SET payment_link_id = ?, payos_order_code = ?, payment_expires_at = ?, payment_created_at = GETDATE()
           WHERE id = ?`,
          [payosResult.paymentLinkId, payosResult.payosOrderCode, payosResult.paymentExpiresAt, result.order_id]
        );

        result.checkout_url = payosResult.checkoutUrl;
        result.qr_code = payosResult.qrCode;
        result.payment_expires_at = payosResult.paymentExpiresAt;
        result.payment_link_id = payosResult.paymentLinkId;
        result.payos_order_code = payosResult.payosOrderCode;
      } catch (payosErr) {
        console.error('PayOS Link Creation Error:', payosErr.message);
        await db.query(
          `UPDATE orders SET payment_status = 'expired', updated_at = GETDATE() WHERE id = ?`,
          [result.order_id]
        );
        return res.status(400).json({
          error: 'Không tạo được link thanh toán PayOS. Vui lòng thử lại: ' + payosErr.message,
          order_id: result.order_id,
          order_code: result.order_code,
        });
      }
    }

    res.status(201).json({ ...result, status: 'Đang chuẩn bị' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


export default router;

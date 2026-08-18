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
    let sql = 'SELECT * FROM promotions WHERE is_active = TRUE';
    const params = [];
    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    sql += ' ORDER BY start_date DESC';
    const [rows] = await postgresDb.query(sql, params);
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

router.get('/users/:id/orders', authenticate, requireCustomerSelf, async (req, res) => {
  try {
    const requestedId = Number(req.params.id);
    const limit = validatePaginationLimit(req.query.limit, 50, 100);
    const cursor = decodeCursor(req.query.cursor);
    const rows = await ordersRepository.listCustomerOrders({ userId: requestedId, limit, cursor });

    const { rows: pagedOrders, page_info } = buildPageInfo({ rows, limit });

    await batchLoadPostgresOrderDetails(pagedOrders);

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
    const order = await ordersRepository.findPublicOrder(code);
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

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

    const mappedItems = await ordersRepository.loadPublicDetails(order.id);
    const history = await ordersRepository.loadStatusHistory(order.id);

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

    const result = await ordersRepository.cancelCustomerOrder({
      identifier: orderIdentifier,
      userId: authUserId,
      cancelToken: rawCancelToken,
      reason,
      evaluateTransition: evaluateOrderTransition,
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
    const [rows] = await postgresDb.query(
      `SELECT t.id, t.name, t.store_id, s.name AS store_name, s.address AS store_address
       FROM tables t JOIN stores s ON s.id = t.store_id
       WHERE t.id = $1 AND t.is_active = TRUE`,
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

    if (normalizedSource === 'online' && !customerUserId) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập tài khoản trước khi đặt hàng' });
    }

    // Generate guest cancellation token if guest order
    let rawCancelToken = null;
    let cancelTokenHash = null;
    if (!customerUserId && normalizedSource === 'online') {
      rawCancelToken = crypto.randomBytes(32).toString('hex');
      cancelTokenHash = crypto.createHash('sha256').update(rawCancelToken).digest('hex');
    }

    const idempotencyKey = String(req.headers['idempotency-key'] || '');
    if (normalizedSource === 'online') {
      if (normalizedPaymentMethod === 'VietQR') {
        const payosOrder = await createOnlinePayOSOrder({
          input: req.body,
          userId: customerUserId,
          cancelTokenHash,
          cancelToken: rawCancelToken,
          idempotencyKey,
        });
        return res.status(payosOrder.replay ? 200 : 201).json({ ...payosOrder, status: 'Đang chuẩn bị' });
      }
      const order = await ordersRepository.createPublicOrder({
        input: req.body,
        userId: customerUserId,
        cancelTokenHash,
        cancelToken: rawCancelToken,
        idempotencyKey,
        requestHash: hashOrderRequest(req.body),
        paymentProvider: payment_provider,
      });
      return res.status(order.replay ? 200 : 201).json({ ...order, status: 'Đang chuẩn bị' });
    }
    const order = await ordersRepository.createPublicOrder({
      input: req.body,
      userId: customerUserId,
      cancelTokenHash,
      cancelToken: rawCancelToken,
      idempotencyKey,
      requestHash: hashOrderRequest(req.body),
      paymentProvider: payment_provider,
    });
    res.status(order.replay ? 200 : 201).json({ ...order, status: 'Đang chuẩn bị' });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});


export default router;

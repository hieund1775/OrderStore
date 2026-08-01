import { Router } from 'express';
import db from '../config/db.js';

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
    const { category, search, tag } = req.query;
    let sql = `SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p JOIN categories c ON p.category_id = c.id
      WHERE p.is_available = 1 AND c.is_visible = 1`;
    const params = [];
    if (category) { sql += ' AND c.slug = ?'; params.push(category); }
    if (search)   { sql += ' AND (p.name LIKE ? OR p.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (tag)      { sql += ' AND p.tags LIKE ?'; params.push(`%"${tag}"%`); }
    sql += ' ORDER BY c.sort_order, p.id';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
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
    const [rows] = await db.query(
      'SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.slug = ?',
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  try { const [r] = await db.query('SELECT * FROM categories WHERE is_visible = 1 ORDER BY sort_order'); res.json(r); }
  catch (err) { res.status(500).json({ error: err.message }); }
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
router.get('/options/sizes',    async (req, res) => { const [r] = await db.query('SELECT * FROM size_options ORDER BY sort_order'); res.json(r); });
router.get('/options/bases',    async (req, res) => { const [r] = await db.query('SELECT * FROM base_options ORDER BY sort_order'); res.json(r); });
router.get('/options/sugars',   async (req, res) => { const [r] = await db.query('SELECT * FROM sugar_options ORDER BY sort_order'); res.json(r); });
router.get('/options/ices',     async (req, res) => { const [r] = await db.query('SELECT * FROM ice_options ORDER BY sort_order'); res.json(r); });
router.get('/options/toppings', async (req, res) => { const [r] = await db.query('SELECT * FROM toppings WHERE is_available = 1 ORDER BY sort_order'); res.json(r); });

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
    const { city, district } = req.query;
    let sql = 'SELECT * FROM stores WHERE is_active = 1';
    const params = [];
    if (city)     { sql += ' AND city = ?';    params.push(city); }
    if (district) { sql += ' AND district = ?'; params.push(district); }
    sql += ' ORDER BY id';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/stores/districts', async (req, res) => {
  try { const [r] = await db.query('SELECT DISTINCT city, district FROM stores WHERE is_active = 1 ORDER BY city, district'); res.json(r); }
  catch (err) { res.status(500).json({ error: err.message }); }
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
  try { const [r] = await db.query('SELECT * FROM jobs WHERE is_active = 1 ORDER BY id'); res.json(r); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/jobs/:id/apply', async (req, res) => {
  try {
    const { fullname, phone, email, store_id, cv_url } = req.body;
    if (!fullname || !phone || !email) return res.status(400).json({ error: 'Vui lòng điền đầy đủ họ tên, SĐT, email' });
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
  try { const [r] = await db.query('SELECT * FROM tier_rules ORDER BY min_points'); res.json(r); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/rewards', async (req, res) => {
  try { const [r] = await db.query('SELECT * FROM rewards WHERE is_active = 1 ORDER BY points_cost'); res.json(r); }
  catch (err) { res.status(500).json({ error: err.message }); }
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
router.get('/users/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, fullname, phone, email, avatar_url, address, tier, points, total_spent, created_at FROM users WHERE id = ? AND is_admin = 0 AND is_active = 1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id/orders', async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT o.*, s.name AS store_name,
        (SELECT TOP 1 osh.status FROM order_status_history osh WHERE osh.order_id = o.id ORDER BY osh.created_at DESC) AS current_status
      FROM orders o JOIN stores s ON o.store_id = s.id WHERE o.user_id = ? ORDER BY o.created_at DESC
    `, [req.params.id]);
    for (const order of orders) {
      const [items] = await db.query(`
        SELECT oi.*,
          (SELECT topping_name AS name, topping_price AS price FROM order_item_toppings WHERE order_item_id = oi.id FOR JSON PATH) AS toppings
        FROM order_items oi WHERE oi.order_id = ?
      `, [order.id]);
      order.items = items.map(i => {
        let tops = [];
        try { tops = JSON.parse(i.toppings || '[]'); } catch {}
        return { ...i, toppings: tops };
      });
    }
    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id/wishlist', async (req, res) => {
  try { const [r] = await db.query('SELECT w.*, p.name AS product_name, p.slug, p.price, p.image_url, p.rating FROM wishlists w JOIN products p ON w.product_id = p.id WHERE w.user_id = ?', [req.params.id]); res.json(r); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/:id/wishlist/:productId', async (req, res) => {
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

router.get('/users/:id/notifications', async (req, res) => {
  try { const [r] = await db.query('SELECT TOP 30 * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC', [req.params.id]); res.json(r); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id/vouchers', async (req, res) => {
  try {
    const [r] = await db.query(`
      SELECT uv.*, p.title AS promotion_title, p.[rule], p.discount_value, p.discount_type, p.max_discount, p.min_order
      FROM user_vouchers uv LEFT JOIN promotions p ON uv.promotion_id = p.id
      WHERE uv.user_id = ? AND uv.used_at IS NULL AND (uv.expires_at IS NULL OR uv.expires_at >= CAST(GETDATE() AS DATE))
      ORDER BY uv.created_at DESC
    `, [req.params.id]); res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/products/:id/reviews', async (req, res) => {
  try {
    const [r] = await db.query(
      'SELECT r.*, u.fullname, u.avatar_url FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.product_id = ? ORDER BY r.created_at DESC',
      [req.params.id]
    ); res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/products/:id/reviews', async (req, res) => {
  try {
    const { user_id, order_item_id, rating, comment, image_urls } = req.body;
    if (!user_id || !rating) return res.status(400).json({ error: 'Thiếu user_id hoặc rating' });
    await db.query(
      'INSERT INTO reviews (user_id, product_id, order_item_id, rating, comment, image_urls) VALUES (?,?,?,?,?,?)',
      [user_id, req.params.id, order_item_id || null, rating, comment || null, image_urls ? JSON.stringify(image_urls) : null]
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
    const { q } = req.query;
    const [products] = await db.query("SELECT DISTINCT TOP 6 name FROM products WHERE is_available = 1 AND name LIKE ?", [`%${q || ''}%`]);
    const [toppings] = await db.query("SELECT DISTINCT TOP 3 name FROM toppings WHERE is_available = 1 AND name LIKE ?", [`%${q || ''}%`]);
    res.json({ products: products.map(p => p.name), toppings: toppings.map(t => t.name) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;

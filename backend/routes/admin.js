/**
 * @swagger
 * /admin/dashboard/kpi:
 *   get:
 *     tags: [Dashboard]
 *     summary: KPI tổng quan (doanh thu, đơn hàng, tỷ lệ hủy, số ly)
 *     responses: { 200: { description: OK } }
 * /admin/dashboard/urgent:
 *   get:
 *     tags: [Dashboard]
 *     summary: Cảnh báo khẩn (tồn kho thấp, món tạm ngưng, đơn đang làm)
 *     responses: { 200: { description: OK } }
 * /admin/dashboard/revenue-by-hour:
 *   get:
 *     tags: [Dashboard]
 *     summary: Doanh thu theo giờ trong ngày
 *     responses: { 200: { description: OK } }
 * /admin/dashboard/revenue-by-category:
 *   get:
 *     tags: [Dashboard]
 *     summary: Doanh thu theo danh mục
 *     responses: { 200: { description: OK } }
 * /admin/dashboard/revenue-by-branch:
 *   get:
 *     tags: [Dashboard]
 *     summary: Doanh thu theo chi nhánh
 *     responses: { 200: { description: OK } }
 * /admin/dashboard/top-products:
 *   get:
 *     tags: [Dashboard]
 *     summary: Top 10 sản phẩm bán chạy
 *     responses: { 200: { description: OK } }
 *
 * /admin/orders:
 *   get:
 *     tags: [Admin Orders]
 *     summary: Danh sách đơn hàng (có filter)
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: store_id
 *         schema: { type: integer }
 *       - in: query
 *         name: date_from
 *         schema: { type: string }
 *       - in: query
 *         name: date_to
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses: { 200: { description: OK } }
 * /admin/orders/{id}:
 *   get:
 *     tags: [Admin Orders]
 *     summary: Chi tiết đơn hàng (kèm items + status history)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses: { 200: { description: OK }, 404: { description: Not found } }
 * /admin/orders/{id}/status:
 *   put:
 *     tags: [Admin Orders]
 *     summary: Cập nhật trạng thái đơn hàng
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: ['Chờ xác nhận','Đã xác nhận','Đang chuẩn bị','Đang giao','Hoàn thành','Đã hủy'] }
 *               note: { type: string }
 *               changed_by: { type: integer }
 *     responses: { 200: { description: OK } }
 * /admin/orders/{id}/cancel:
 *   put:
 *     tags: [Admin Orders]
 *     summary: Hủy đơn hàng
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *               changed_by: { type: integer }
 *     responses: { 200: { description: OK } }
 *
 * /admin/menu/categories:
 *   get:
 *     tags: [Admin Menu]
 *     summary: Quản lý danh mục
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [Admin Menu]
 *     summary: Tạo danh mục mới
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug]
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               sort_order: { type: integer }
 *               is_visible: { type: boolean }
 *     responses: { 201: { description: Created } }
 * /admin/menu/categories/{id}:
 *   put:
 *     tags: [Admin Menu]
 *     summary: Cập nhật danh mục
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses: { 200: { description: OK } }
 * /admin/menu/products:
 *   get:
 *     tags: [Admin Menu]
 *     summary: Quản lý sản phẩm
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema: { type: integer }
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [Admin Menu]
 *     summary: Thêm món mới
 *     responses: { 201: { description: Created } }
 * /admin/menu/products/{id}:
 *   put:
 *     tags: [Admin Menu]
 *     summary: Cập nhật món
 *     responses: { 200: { description: OK } }
 * /admin/menu/products/{id}/toggle:
 *   put:
 *     tags: [Admin Menu]
 *     summary: Bật/tắt món
 *     responses: { 200: { description: OK } }
 * /admin/menu/options:
 *   get:
 *     tags: [Admin Menu]
 *     summary: Tất cả tùy chọn (size, cốt trà, đường, đá, topping)
 *     responses: { 200: { description: OK } }
 *
 * /admin/customers:
 *   get:
 *     tags: [Admin Customers]
 *     summary: Danh sách khách hàng
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: tier
 *         schema: { type: string }
 *     responses: { 200: { description: OK } }
 * /admin/customers/{id}:
 *   get:
 *     tags: [Admin Customers]
 *     summary: Chi tiết khách hàng (kèm đơn hàng gần đây, LTV)
 *     responses: { 200: { description: OK } }
 *
 * /admin/branches:
 *   get:
 *     tags: [Admin Branches]
 *     summary: Quản lý chi nhánh
 *     responses: { 200: { description: OK } }
 * /admin/branches/{id}:
 *   put:
 *     tags: [Admin Branches]
 *     summary: Cập nhật chi nhánh
 *     responses: { 200: { description: OK } }
 *
 * /admin/promotions:
 *   get:
 *     tags: [Admin Promotions]
 *     summary: Quản lý khuyến mãi
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [Admin Promotions]
 *     summary: Tạo khuyến mãi mới
 *     responses: { 201: { description: Created } }
 * /admin/promotions/{id}:
 *   put:
 *     tags: [Admin Promotions]
 *     summary: Cập nhật khuyến mãi
 *     responses: { 200: { description: OK } }
 *
 * /admin/inventory:
 *   get:
 *     tags: [Admin Inventory]
 *     summary: Tồn kho nguyên liệu
 *     parameters:
 *       - in: query
 *         name: store_id
 *         schema: { type: integer }
 *     responses: { 200: { description: OK } }
 * /admin/inventory/{id}:
 *   put:
 *     tags: [Admin Inventory]
 *     summary: Cập nhật số lượng tồn kho
 *     responses: { 200: { description: OK } }
 * /admin/inventory/{id}/log:
 *   post:
 *     tags: [Admin Inventory]
 *     summary: Nhập/xuất kho
 *     responses: { 200: { description: OK } }
 *
 * /admin/kitchen/orders:
 *   get:
 *     tags: [Admin Kitchen]
 *     summary: Màn hình bếp (KDS) — các đơn đang chờ / đang làm
 *     responses: { 200: { description: OK } }
 *
 * /admin/reports/summary:
 *   get:
 *     tags: [Admin Reports]
 *     summary: Báo cáo doanh thu theo khoảng thời gian
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses: { 200: { description: OK } }
 *
 * /admin/settings/accounts:
 *   get:
 *     tags: [Admin Settings]
 *     summary: Danh sách tài khoản admin
 *     responses: { 200: { description: OK } }
 * /admin/settings/audit-logs:
 *   get:
 *     tags: [Admin Settings]
 *     summary: Nhật ký hoạt động admin
 *     responses: { 200: { description: OK } }
 *
 * /admin/notifications:
 *   get:
 *     tags: [Admin Notifications]
 *     summary: Danh sách thông báo hệ thống
 *     responses: { 200: { description: OK } }
 *   post:
 *     tags: [Admin Notifications]
 *     summary: Gửi thông báo mới
 *     responses: { 201: { description: Created } }
 */
import { Router } from 'express';
import crypto from 'crypto';
import db from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

const router = Router();

// Toàn bộ /admin/* (trừ POST /admin/login đã nằm trong routes/auth.js) cần JWT + RBAC
router.use(authenticate, requireRole('super', 'manager', 'kitchen', 'cashier'));

// ═══════════ DASHBOARD ═══════════

router.get('/dashboard/kpi', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [rev]    = await db.query("SELECT COALESCE(SUM(total),0) AS v FROM orders WHERE CAST(created_at AS DATE)=? AND id NOT IN (SELECT order_id FROM order_status_history WHERE status=N'Đã hủy')",[today]);
    const [ord]    = await db.query("SELECT COUNT(*) AS v FROM orders WHERE CAST(created_at AS DATE)=? AND id NOT IN (SELECT order_id FROM order_status_history WHERE status=N'Đã hủy')",[today]);
    const [cancel] = await db.query("SELECT COUNT(*) AS v FROM orders o WHERE CAST(o.created_at AS DATE)=? AND EXISTS (SELECT 1 FROM order_status_history osh WHERE osh.order_id=o.id AND osh.status=N'Đã hủy')",[today]);
    const [cups]   = await db.query("SELECT COALESCE(SUM(oi.qty),0) AS v FROM order_items oi JOIN orders o ON oi.order_id=o.id WHERE CAST(o.created_at AS DATE)=? AND o.id NOT IN (SELECT order_id FROM order_status_history WHERE status=N'Đã hủy')",[today]);
    const total = ord[0].v + cancel[0].v;
    res.json({
      revenue:{value:rev[0].v,label:'Doanh thu tạm tính'}, orders:{value:ord[0].v,label:'Đơn hoàn thành'},
      cancelRate:{value:total>0?((cancel[0].v/total)*100).toFixed(1)+'%':'0%',label:'Tỷ lệ hủy đơn'},
      cups:{value:cups[0].v,label:'Tổng ly đã bán'}
    });
  } catch(err) { res.status(500).json({error:err.message}); }
});

router.get('/dashboard/urgent', async (req,res) => {
  try {
    const [b]=await db.query('SELECT COUNT(*) AS v FROM products WHERE is_available = 0');
    const [c]=await db.query("SELECT COUNT(*) AS v FROM order_status_history WHERE status=N'Đang chuẩn bị' AND id IN (SELECT MAX(id) FROM order_status_history GROUP BY order_id)");
    res.json({paused:b[0].v,preparing:c[0].v});
  } catch(err) { res.status(500).json({error:err.message}); }
});

router.get('/dashboard/revenue-by-hour', async (req,res) => {
  try { const [r]=await db.query("SELECT DATEPART(HOUR,created_at) AS hour, COALESCE(SUM(total),0) AS value FROM orders WHERE CAST(created_at AS DATE)=CAST(GETDATE() AS DATE) AND id NOT IN (SELECT order_id FROM order_status_history WHERE status=N'Đã hủy') GROUP BY DATEPART(HOUR,created_at) ORDER BY hour"); res.json(r); }
  catch(err) { res.status(500).json({error:err.message}); }
});

router.get('/dashboard/revenue-by-category', async (req,res) => {
  try { const [r]=await db.query("SELECT c.name, COALESCE(SUM(oi.line_total),0) AS value FROM order_items oi JOIN products p ON oi.product_id=p.id JOIN categories c ON p.category_id=c.id JOIN orders o ON oi.order_id=o.id WHERE o.id NOT IN (SELECT order_id FROM order_status_history WHERE status=N'Đã hủy') GROUP BY c.id,c.name ORDER BY value DESC"); res.json(r); }
  catch(err) { res.status(500).json({error:err.message}); }
});

router.get('/dashboard/revenue-by-branch', async (req,res) => {
  try { const [r]=await db.query("SELECT s.name, COALESCE(SUM(o.total),0) AS value FROM orders o JOIN stores s ON o.store_id=s.id WHERE o.id NOT IN (SELECT order_id FROM order_status_history WHERE status=N'Đã hủy') GROUP BY s.id,s.name ORDER BY value DESC"); res.json(r); }
  catch(err) { res.status(500).json({error:err.message}); }
});

router.get('/dashboard/top-products', async (req,res) => {
  try { const [r]=await db.query("SELECT TOP 10 p.name, SUM(oi.qty) AS qty, SUM(oi.line_total) AS revenue FROM order_items oi JOIN products p ON oi.product_id=p.id JOIN orders o ON oi.order_id=o.id WHERE o.id NOT IN (SELECT order_id FROM order_status_history WHERE status=N'Đã hủy') GROUP BY p.id,p.name ORDER BY qty DESC"); res.json(r); }
  catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════ ORDERS ═══════════

router.get('/orders', async (req,res) => {
  try {
    const {status,store_id,date_from,date_to,search}=req.query;
    let sql=`SELECT TOP 100 o.*, s.name AS store_name, (SELECT TOP 1 osh.status FROM order_status_history osh WHERE osh.order_id=o.id ORDER BY osh.created_at DESC) AS current_status FROM orders o JOIN stores s ON o.store_id=s.id WHERE 1=1`;
    const params=[];
    if(status){sql+=' AND (SELECT TOP 1 osh2.status FROM order_status_history osh2 WHERE osh2.order_id=o.id ORDER BY osh2.created_at DESC)=?';params.push(status);}
    if(store_id){sql+=' AND o.store_id=?';params.push(store_id);}
    if(date_from){sql+=' AND CAST(o.created_at AS DATE)>=?';params.push(date_from);}
    if(date_to){sql+=' AND CAST(o.created_at AS DATE)<=?';params.push(date_to);}
    if(search){sql+=' AND (o.order_code LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)';params.push(`%${search}%`,`%${search}%`,`%${search}%`);}
    sql+=' ORDER BY o.created_at DESC';
    const [rows]=await db.query(sql,params); res.json(rows);
  } catch(err) { res.status(500).json({error:err.message}); }
});

router.get('/orders/:id', async (req,res) => {
  try {
    const [rows]=await db.query(`SELECT o.*, s.name AS store_name, (SELECT TOP 1 osh.status FROM order_status_history osh WHERE osh.order_id=o.id ORDER BY osh.created_at DESC) AS current_status FROM orders o JOIN stores s ON o.store_id=s.id WHERE o.id=?`,[req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Không tìm thấy đơn hàng'});
    const order=rows[0];
    const [items]=await db.query(`SELECT oi.*, (SELECT topping_name AS name, topping_price AS price FROM order_item_toppings WHERE order_item_id=oi.id FOR JSON PATH) AS toppings FROM order_items oi WHERE oi.order_id=?`,[order.id]);
    order.items=items.map(i=>{let t=[];try{t=JSON.parse(i.toppings||'[]');}catch{}return{...i,toppings:t};});
    const [history]=await db.query('SELECT osh.*, u.fullname AS changed_by_name FROM order_status_history osh LEFT JOIN users u ON osh.changed_by=u.id WHERE osh.order_id=? ORDER BY osh.created_at',[order.id]);
    order.status_history=history;
    res.json(order);
  } catch(err) { res.status(500).json({error:err.message}); }
});

const updateOrderStatus = async (req, res) => {
  const { status, note, driver_name, driver_phone, tracking_url } = req.body;
  const v = ['Chờ xác nhận', 'Đã xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Hoàn thành', 'Đã hủy'];
  if (!v.some((s) => s === status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  try {
    const result = await db.transaction(async (tx) => {
      const [rows] = await tx.query('SELECT 1 AS x FROM orders WHERE id = ?', [req.params.id]);
      if (rows.length === 0) throw new Error('Không tìm thấy đơn hàng');
      await tx.query(
        'INSERT INTO order_status_history (order_id, status, note, changed_by, created_at) VALUES (?, ?, ?, ?, GETDATE())',
        [req.params.id, status, note || null, req.user.sub],
      );
      if (status === 'Đang chuẩn bị') {
        await tx.query('UPDATE orders SET kitchen_notified_at = GETDATE(), updated_at = GETDATE() WHERE id = ?', [req.params.id]);
      }
      if (status === 'Đang giao' && (driver_name || driver_phone || tracking_url)) {
        await tx.query(
          'UPDATE orders SET shipping_driver_name = ?, shipping_driver_phone = ?, shipping_tracking_url = ?, updated_at = GETDATE() WHERE id = ?',
          [driver_name || null, driver_phone || null, tracking_url || null, req.params.id],
        );
      }
      return { order_id: Number(req.params.id), status };
    });
    await logAudit(req.user.sub, `Cập nhật trạng thái đơn #${req.params.id}`, `→ ${status}`, req);
    res.json({ ...result, message: `Đơn hàng → ${status}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

router.put('/orders/:id/status', updateOrderStatus);
router.patch('/orders/:id/status', updateOrderStatus);

router.put('/orders/:id/cancel', async (req,res) => {
  try {
    const {reason,changed_by}=req.body;
    await db.query("INSERT INTO order_status_history (order_id,status,note,changed_by) VALUES (?,N'Đã hủy',?,?)",[req.params.id,reason||'Hủy bởi admin',changed_by||null]);
    await db.query('UPDATE orders SET cancel_reason=? WHERE id=?',[reason||'',req.params.id]);
    await logAudit(req.user.sub, `Hủy đơn #${req.params.id}`, reason || 'Hủy bởi admin', req);
    res.json({message:'Đơn hàng đã bị hủy'});
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════ MENU ═══════════

router.get('/menu/categories', async (req,res) => {
  try { const [r]=await db.query('SELECT c.*, (SELECT COUNT(*) FROM products WHERE category_id=c.id) AS items FROM categories c ORDER BY c.sort_order'); res.json(r); }
  catch(err) { res.status(500).json({error:err.message}); }
});
router.post('/menu/categories', async (req,res) => {
  try {
    const {name,slug,sort_order,is_visible}=req.body;
    const [r]=await db.query('INSERT INTO categories (name,slug,sort_order,is_visible) OUTPUT INSERTED.id VALUES (?,?,?,?)',[name,slug,sort_order||0,is_visible!==undefined?is_visible:1]);
    await logAudit(req.user.sub, 'Tạo danh mục', `${name} (${slug})`, req);
    res.status(201).json({id:r[0].id,message:'Đã tạo danh mục'});
  } catch(err) {
    if(err.message&&err.message.includes('UNIQUE')) return res.status(409).json({error:'Slug đã tồn tại'});
    res.status(500).json({error:err.message});
  }
});
router.put('/menu/categories/:id', async (req,res) => {
  try { const {name,slug,sort_order,is_visible}=req.body; await db.query('UPDATE categories SET name=?,slug=?,sort_order=?,is_visible=? WHERE id=?',[name,slug,sort_order,is_visible,req.params.id]); await logAudit(req.user.sub, `Cập nhật danh mục #${req.params.id}`, name, req); res.json({message:'Đã cập nhật'}); }
  catch(err) { res.status(500).json({error:err.message}); }
});
router.get('/menu/products', async (req,res) => {
  try { const {category_id}=req.query; let s='SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON p.category_id=c.id WHERE 1=1'; const p=[]; if(category_id){s+=' AND p.category_id=?';p.push(category_id);} s+=' ORDER BY p.id'; const [r]=await db.query(s,p); res.json(r); }
  catch(err) { res.status(500).json({error:err.message}); }
});
router.post('/menu/products', async (req,res) => {
  try {
    const {category_id,name,slug,base_tea,description,price,image_url,calories,fruit_group,tags}=req.body;
    const [r]=await db.query('INSERT INTO products (category_id,name,slug,base_tea,description,price,image_url,calories,fruit_group,tags) OUTPUT INSERTED.id VALUES (?,?,?,?,?,?,?,?,?,?)',[category_id,name,slug,base_tea,description||null,price,image_url||null,calories||0,fruit_group||null,tags?JSON.stringify(tags):null]);
    await logAudit(req.user.sub, 'Thêm món mới', `${name} (${slug})`, req);
    res.status(201).json({id:r[0].id,message:'Đã thêm món'});
  } catch(err) { if(err.message&&err.message.includes('UNIQUE')) return res.status(409).json({error:'Slug đã tồn tại'}); res.status(500).json({error:err.message}); }
});
router.put('/menu/products/:id', async (req,res) => {
  try {
    const fields=['category_id','name','slug','base_tea','description','price','image_url','calories','fruit_group','is_available'];
    const sets=[],params=[];
    for(const f of fields){if(req.body[f]!==undefined){sets.push(`${f}=?`);params.push(req.body[f]);}}
    if(req.body.tags!==undefined){sets.push('tags=?');params.push(JSON.stringify(req.body.tags));}
    if(!sets.length) return res.status(400).json({error:'Không có trường để cập nhật'});
    params.push(req.params.id); await db.query(`UPDATE products SET ${sets.join(',')} WHERE id=?`,params);
    await logAudit(req.user.sub, `Cập nhật món #${req.params.id}`, sets.join(', '), req);
    res.json({message:'Đã cập nhật'});
  } catch(err) { res.status(500).json({error:err.message}); }
});
router.put('/menu/products/:id/toggle', async (req,res) => {
  try { await db.query('UPDATE products SET is_available = CASE WHEN is_available = 1 THEN 0 ELSE 1 END WHERE id=?',[req.params.id]); const [r]=await db.query('SELECT is_available FROM products WHERE id=?',[req.params.id]); await logAudit(req.user.sub, `Bật/tắt món #${req.params.id}`, r[0].is_available ? 'Đang bán' : 'Tạm ngưng', req); res.json({is_available:!!r[0].is_available,message:r[0].is_available?'Đã bật':'Đã tạm ngưng'}); }
  catch(err) { res.status(500).json({error:err.message}); }
});
router.delete('/menu/products/:id', async (req,res) => {
  try {
    const id = req.params.id;
    const [exists] = await db.query('SELECT id, name FROM products WHERE id = ?', [id]);
    if (!exists[0]) return res.status(404).json({ error: 'Không tìm thấy món' });
    const [cnt] = await db.query('SELECT COUNT(*) AS c FROM order_items WHERE product_id = ?', [id]);
    if (cnt[0].c > 0) {
      return res.status(400).json({ error: 'Không thể xóa món đã có trong đơn hàng (' + cnt[0].c + ' lượt)' });
    }
    await db.transaction(async (tx) => {
      await tx.query('DELETE FROM reviews WHERE product_id = ?', [id]);
      await tx.query('DELETE FROM wishlists WHERE product_id = ?', [id]);
      await tx.query('DELETE FROM products WHERE id = ?', [id]);
    });
    await logAudit(req.user.sub, 'Xóa món', `#${id} ${exists[0].name}`, req);
    res.json({ message: 'Đã xóa món' });
  } catch(err) { res.status(500).json({error:err.message}); }
});
router.delete('/menu/categories/:id', async (req,res) => {
  try {
    const id = req.params.id;
    const [exists] = await db.query('SELECT id, name FROM categories WHERE id = ?', [id]);
    if (!exists[0]) return res.status(404).json({ error: 'Không tìm thấy danh mục' });
    const [cnt] = await db.query('SELECT COUNT(*) AS c FROM products WHERE category_id = ?', [id]);
    if (cnt[0].c > 0) {
      return res.status(400).json({ error: 'Không thể xóa danh mục còn ' + cnt[0].c + ' món' });
    }
    await db.query('DELETE FROM categories WHERE id = ?', [id]);
    await logAudit(req.user.sub, 'Xóa danh mục', `#${id} ${exists[0].name}`, req);
    res.json({ message: 'Đã xóa danh mục' });
  } catch(err) { res.status(500).json({error:err.message}); }
});
router.get('/menu/options', async (req,res) => {
  try {
    const [sizes]=await db.query('SELECT * FROM size_options ORDER BY sort_order');
    const [bases]=await db.query('SELECT * FROM base_options ORDER BY sort_order');
    const [sugars]=await db.query('SELECT * FROM sugar_options ORDER BY sort_order');
    const [ices]=await db.query('SELECT * FROM ice_options ORDER BY sort_order');
    const [toppings]=await db.query('SELECT * FROM toppings ORDER BY sort_order');
    res.json({sizes,bases,sugars,ices,toppings});
  } catch(err) { res.status(500).json({error:err.message}); }
});
router.post('/menu/toppings', async (req,res) => {
  try {
    const {name,price,is_available}=req.body;
    if(!name?.trim()) return res.status(400).json({error:'Thiếu tên topping'});
    const [r]=await db.query('INSERT INTO toppings (name,price,is_available,sort_order) OUTPUT INSERTED.* VALUES (?,?,?,0)',[name.trim(),Number(price)||0,is_available===undefined?1:is_available]);
    await logAudit(req.user.sub,'Thêm topping',`${name} (+${price||0})`,req);
    res.status(201).json(r[0]);
  } catch(err) { res.status(500).json({error:err.message}); }
});
router.put('/menu/toppings/:id', async (req,res) => {
  try {
    const {name,price,is_available}=req.body;
    const fields=[],params=[];
    if(name!==undefined){fields.push('name=?');params.push(name.trim());}
    if(price!==undefined){fields.push('price=?');params.push(Number(price)||0);}
    if(is_available!==undefined){fields.push('is_available=?');params.push(is_available);}
    if(!fields.length) return res.status(400).json({error:'Không có trường để cập nhật'});
    params.push(req.params.id);
    await db.query(`UPDATE toppings SET ${fields.join(',')} WHERE id=?`,params);
    await logAudit(req.user.sub,`Cập nhật topping #${req.params.id}`,fields.join(', '),req);
    res.json({message:'Đã cập nhật'});
  } catch(err) { res.status(500).json({error:err.message}); }
});
router.delete('/menu/toppings/:id', async (req,res) => {
  try {
    const [exists]=await db.query('SELECT id,name FROM toppings WHERE id=?',[req.params.id]);
    if(!exists[0]) return res.status(404).json({error:'Không tìm thấy topping'});
    await db.query('DELETE FROM toppings WHERE id=?',[req.params.id]);
    await logAudit(req.user.sub,'Xóa topping',`#${req.params.id} ${exists[0].name}`,req);
    res.json({message:'Đã xóa topping'});
  } catch(err) { res.status(500).json({error:err.message}); }
});
router.post('/menu/bases', async (req,res) => {
  try {
    const {name}=req.body;
    if(!name?.trim()) return res.status(400).json({error:'Thiếu tên cốt trà'});
    const [r]=await db.query('INSERT INTO base_options (name,sort_order) OUTPUT INSERTED.* VALUES (?,0)',[name.trim()]);
    await logAudit(req.user.sub,'Thêm cốt trà nền',name.trim(),req);
    res.status(201).json(r[0]);
  } catch(err) { if(err.message&&err.message.includes('UNIQUE')) return res.status(409).json({error:'Cốt trà này đã tồn tại'}); res.status(500).json({error:err.message}); }
});
router.put('/menu/bases/:id', async (req,res) => {
  try {
    const {name}=req.body;
    if(!name?.trim()) return res.status(400).json({error:'Thiếu tên cốt trà'});
    await db.query('UPDATE base_options SET name=? WHERE id=?',[name.trim(),req.params.id]);
    await logAudit(req.user.sub,`Cập nhật cốt trà #${req.params.id}`,name.trim(),req);
    res.json({message:'Đã cập nhật'});
  } catch(err) { if(err.message&&err.message.includes('UNIQUE')) return res.status(409).json({error:'Cốt trà này đã tồn tại'}); res.status(500).json({error:err.message}); }
});
router.delete('/menu/bases/:id', async (req,res) => {
  try {
    const [exists]=await db.query('SELECT id,name FROM base_options WHERE id=?',[req.params.id]);
    if(!exists[0]) return res.status(404).json({error:'Không tìm thấy cốt trà'});
    await db.query('DELETE FROM base_options WHERE id=?',[req.params.id]);
    await logAudit(req.user.sub,'Xóa cốt trà nền',`#${req.params.id} ${exists[0].name}`,req);
    res.json({message:'Đã xóa cốt trà'});
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════ CUSTOMERS ═══════════

router.get('/customers', async (req,res) => {
  try {
    const {search,tier}=req.query;
    let sql=`SELECT u.id,u.fullname,u.phone,u.email,u.tier,u.points,u.total_spent,(SELECT COUNT(*) FROM orders WHERE user_id=u.id) AS order_count,(SELECT MAX(created_at) FROM orders WHERE user_id=u.id) AS last_order FROM users u WHERE u.is_admin=0 AND u.is_active=1`;
    const params=[];
    if(search){sql+=' AND (u.fullname LIKE ? OR u.phone LIKE ?)';params.push(`%${search}%`,`%${search}%`);}
    if(tier){sql+=' AND u.tier=?';params.push(tier);}
    sql+=' ORDER BY u.points DESC'; const [rows]=await db.query(sql,params); res.json(rows);
  } catch(err) { res.status(500).json({error:err.message}); }
});
router.get('/customers/:id', async (req,res) => {
  try {
    const [rows]=await db.query('SELECT id,fullname,phone,email,avatar_url,address,tier,points,total_spent,created_at FROM users WHERE id=? AND is_admin=0',[req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Không tìm thấy'});
    const user=rows[0];
    const [orders]=await db.query('SELECT TOP 20 o.*, s.name AS store_name FROM orders o JOIN stores s ON o.store_id=s.id WHERE o.user_id=? ORDER BY o.created_at DESC',[user.id]);
    user.recent_orders=orders;
    const [ltvR]=await db.query('SELECT COALESCE(SUM(total),0) AS v FROM orders WHERE user_id=?',[user.id]);
    user.ltv=ltvR[0].v; res.json(user);
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════ BRANCHES ═══════════
router.get('/branches', async (req,res) => {
  try {
    const [r]=await db.query(`
      SELECT s.id, s.name, s.city, s.district, s.address, s.lat, s.lng, s.hours, s.phone, s.amenities, s.is_active, s.created_at,
        (SELECT COUNT(*) FROM tables t WHERE t.store_id = s.id) AS table_count,
        (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id AND CAST(o.created_at AS DATE) = CAST(GETDATE() AS DATE)
          AND o.id NOT IN (SELECT order_id FROM order_status_history WHERE status = N'Đã hủy')) AS today_orders,
        ISNULL((SELECT SUM(o.total) FROM orders o WHERE o.store_id = s.id AND CAST(o.created_at AS DATE) = CAST(GETDATE() AS DATE)
          AND o.id NOT IN (SELECT order_id FROM order_status_history WHERE status = N'Đã hủy')), 0) AS today_revenue
      FROM stores s ORDER BY s.id`);
    res.json(r);
  } catch(err){res.status(500).json({error:err.message});}
});
router.post('/branches', async (req,res) => {
  try {
    const {name,city,district,address,lat,lng,hours,phone,amenities,is_active}=req.body;
    if(!name?.trim()||!city?.trim()||!district?.trim()||!address?.trim()||!phone?.trim()){
      return res.status(400).json({error:'Thiếu thông tin chi nhánh (tên, thành phố, quận/huyện, địa chỉ, SĐT)'});
    }
    const [r]=await db.query(
      'INSERT INTO stores (name,city,district,address,lat,lng,hours,phone,amenities,is_active) OUTPUT INSERTED.id VALUES (?,?,?,?,?,?,?,?,?,?)',
      [name.trim(),city.trim(),district.trim(),address.trim(),lat??null,lng??null,hours||'07:00 – 22:00',phone.trim(),amenities?JSON.stringify(amenities):null,is_active!==undefined?is_active:1],
    );
    await logAudit(req.user.sub,'Tạo chi nhánh',`${name} (${city})`,req);
    res.status(201).json({id:r[0].id,message:'Đã tạo chi nhánh'});
  } catch(err) { res.status(500).json({error:err.message}); }
});
router.put('/branches/:id', async (req,res) => {
  try { const {name,city,district,address,lat,lng,hours,phone,amenities,is_active}=req.body; await db.query('UPDATE stores SET name=?,city=?,district=?,address=?,lat=?,lng=?,hours=?,phone=?,amenities=?,is_active=? WHERE id=?',[name,city,district,address,lat??null,lng??null,hours,phone,amenities?JSON.stringify(amenities):null,is_active,req.params.id]); await logAudit(req.user.sub, `Cập nhật chi nhánh #${req.params.id}`, name, req); res.json({message:'Đã cập nhật'}); }
  catch(err) { res.status(500).json({error:err.message}); }
});
router.delete('/branches/:id', async (req,res) => {
  try {
    const id = req.params.id;
    const [exists] = await db.query('SELECT id, name FROM stores WHERE id = ?', [id]);
    if (!exists[0]) return res.status(404).json({ error: 'Không tìm thấy chi nhánh' });
    const [cnt] = await db.query('SELECT COUNT(*) AS c FROM orders WHERE store_id = ?', [id]);
    if (cnt[0].c > 0) {
      return res.status(400).json({ error: 'Không thể xóa chi nhánh đã có đơn hàng (' + cnt[0].c + ' đơn)' });
    }
    await db.transaction(async (tx) => {
      await tx.query('DELETE FROM promotion_stores WHERE store_id = ?', [id]);
      await tx.query('DELETE FROM tables WHERE store_id = ?', [id]);
      await tx.query('DELETE FROM stores WHERE id = ?', [id]);
    });
    await logAudit(req.user.sub, 'Xóa chi nhánh', `#${id} ${exists[0].name}`, req);
    res.json({ message: 'Đã xóa chi nhánh' });
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════ PROMOTIONS ═══════════
router.get('/promotions', async (req,res) => { try { const [r]=await db.query('SELECT * FROM promotions ORDER BY start_date DESC'); res.json(r); } catch(err){res.status(500).json({error:err.message});} });
router.post('/promotions', async (req,res) => {
  try {
    const {title,type,code,description,rule,emoji,discount_value,discount_type,max_discount,min_order,start_date,end_date,audience,scope,voucher_type,usage_limit}=req.body;
    const st=new Date(start_date)>new Date()?'Lên lịch':new Date(end_date)<new Date()?'Đã kết thúc':'Đang diễn ra';
    const [r]=await db.query('INSERT INTO promotions (title,type,code,description,[rule],emoji,discount_value,discount_type,max_discount,min_order,start_date,end_date,status,audience,scope,voucher_type,usage_limit) OUTPUT INSERTED.id VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[title,type,code||null,description||null,rule||null,emoji||null,discount_value||null,discount_type||null,max_discount||null,min_order||null,start_date,end_date,st,audience||null,scope||null,voucher_type||'time_bounded',usage_limit||null]);
    await logAudit(req.user.sub, 'Tạo khuyến mãi', `${title} (${code || 'không mã'})`, req);
    res.status(201).json({id:r[0].id,message:'Đã tạo KM'});
  } catch(err) { if(err.message&&err.message.includes('UNIQUE')) return res.status(409).json({error:'Mã KM đã tồn tại'}); res.status(500).json({error:err.message}); }
});
router.put('/promotions/:id', async (req,res) => {
  try {
    const fields=[{name:'rule',sql:'[rule]'},'title','type','code','description','emoji','discount_value','discount_type','max_discount','min_order','start_date','end_date','status','audience','scope','is_active','voucher_type','usage_limit'];
    const sets=[],params=[]; for(const f of fields){
      const fn=typeof f==='string'?f:f.name; const fs=typeof f==='string'?f:f.sql;
      if(req.body[fn]!==undefined){sets.push(`${fs}=?`);params.push(req.body[fn]);}
    }
    params.push(req.params.id); await db.query(`UPDATE promotions SET ${sets.join(',')} WHERE id=?`,params);
    await logAudit(req.user.sub, `Cập nhật khuyến mãi #${req.params.id}`, sets.join(', '), req);
    res.json({message:'Đã cập nhật'});
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════ INVENTORY ═══════════
router.get('/inventory', async (req,res) => {
  try { const {store_id}=req.query; let s='SELECT i.*, s2.name AS store_name FROM ingredients i JOIN stores s2 ON i.store_id=s2.id WHERE 1=1'; const p=[]; if(store_id){s+=' AND i.store_id=?';p.push(store_id);} s+=' ORDER BY i.kind,i.name'; const [r]=await db.query(s,p); res.json(r); }
  catch(err) { res.status(500).json({error:err.message}); }
});
router.put('/inventory/:id', async (req,res) => {
  try { const {stock,safe_level}=req.body; await db.query('UPDATE ingredients SET stock=?,safe_level=? WHERE id=?',[stock,safe_level,req.params.id]); res.json({message:'Đã cập nhật'}); }
  catch(err) { res.status(500).json({error:err.message}); }
});
router.post('/inventory/:id/log', async (req,res) => {
  try { const {change_amount,reason,reference,created_by}=req.body; await db.query('UPDATE ingredients SET stock=stock+? WHERE id=?',[change_amount,req.params.id]); await db.query('INSERT INTO ingredient_logs (ingredient_id,change_amount,reason,reference,created_by) VALUES (?,?,?,?,?)',[req.params.id,change_amount,reason,reference||null,created_by||null]); res.json({message:'Đã cập nhật kho'}); }
  catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════ KITCHEN ═══════════
router.get('/kitchen/orders', async (req,res) => {
  try {
    const { store_id } = req.query;
    let sql = "SELECT o.id,o.order_code,o.order_type,o.customer_name,o.customer_phone,o.delivery_addr,o.table_id,o.store_id,o.location_name,o.note,o.subtotal,o.discount_amount,o.total,o.payment_method,o.created_at,s.name AS store_name,(SELECT TOP 1 osh.status FROM order_status_history osh WHERE osh.order_id=o.id ORDER BY osh.created_at DESC) AS current_status FROM orders o JOIN stores s ON o.store_id=s.id WHERE (SELECT TOP 1 osh2.status FROM order_status_history osh2 WHERE osh2.order_id=o.id ORDER BY osh2.created_at DESC) IN (N'Đang chuẩn bị', N'Chờ xác nhận')";
    const params = [];
    if (store_id && store_id !== 'all') {
      sql += " AND o.store_id = ?";
      params.push(store_id);
    }
    sql += " ORDER BY o.created_at";
    const [orders] = await db.query(sql, params);
    for(const o of orders){const [items]=await db.query("SELECT oi.*, (SELECT topping_name AS name, topping_price AS price FROM order_item_toppings WHERE order_item_id=oi.id FOR JSON PATH) AS toppings FROM order_items oi WHERE oi.order_id=?",[o.id]);o.items=items.map(i=>{let t=[];try{t=JSON.parse(i.toppings||'[]');}catch{}return{...i,toppings:t};});}
    res.json(orders);
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════ REPORTS ═══════════
router.get('/reports/kpi-summary', async (req,res) => {
  try {
    const {from,to}=req.query; const df=from||new Date().toISOString().split('T')[0]; const dt=to||new Date().toISOString().split('T')[0];
    const [rev]=await db.query("SELECT COALESCE(SUM(total),0) AS v FROM orders WHERE CAST(created_at AS DATE) BETWEEN ? AND ? AND id NOT IN (SELECT order_id FROM order_status_history WHERE status=N'Đã hủy')",[df,dt]);
    const [ord]=await db.query("SELECT COUNT(*) AS total, COALESCE(AVG(CAST(total AS DECIMAL)),0) AS avg FROM orders WHERE CAST(created_at AS DATE) BETWEEN ? AND ? AND id NOT IN (SELECT order_id FROM order_status_history WHERE status=N'Đã hủy')",[df,dt]);
    const [cancel]=await db.query("SELECT COUNT(*) AS v FROM orders o WHERE CAST(o.created_at AS DATE) BETWEEN ? AND ? AND EXISTS (SELECT 1 FROM order_status_history osh WHERE osh.order_id=o.id AND osh.status=N'Đã hủy')",[df,dt]);
    const totalOrders=ord[0].total+cancel[0].v;
    res.json({
      period:{from:df,to:dt},
      revenue:rev[0].v,
      total_orders:ord[0].total,
      avg_order:Math.round(ord[0].avg),
      cancelled:cancel[0].v,
      cancel_rate:totalOrders>0?Number(((cancel[0].v/totalOrders)*100).toFixed(1)):0,
    });
  } catch(err) { res.status(500).json({error:err.message}); }
});

router.get('/reports/summary', async (req,res) => {
  try {
    const {from,to}=req.query; const df=from||new Date().toISOString().split('T')[0]; const dt=to||new Date().toISOString().split('T')[0];
    const [rev]=await db.query("SELECT COALESCE(SUM(total),0) AS v FROM orders WHERE CAST(created_at AS DATE) BETWEEN ? AND ? AND id NOT IN (SELECT order_id FROM order_status_history WHERE status=N'Đã hủy')",[df,dt]);
    const [ord]=await db.query("SELECT COUNT(*) AS total, COALESCE(AVG(CAST(total AS DECIMAL)),0) AS avg FROM orders WHERE CAST(created_at AS DATE) BETWEEN ? AND ? AND id NOT IN (SELECT order_id FROM order_status_history WHERE status=N'Đã hủy')",[df,dt]);
    const [cancel]=await db.query("SELECT COUNT(*) AS v FROM orders o WHERE CAST(o.created_at AS DATE) BETWEEN ? AND ? AND EXISTS (SELECT 1 FROM order_status_history osh WHERE osh.order_id=o.id AND osh.status=N'Đã hủy')",[df,dt]);
    res.json({period:{from:df,to:dt},revenue:rev[0].v,total_orders:ord[0].total,avg_order:Math.round(ord[0].avg),cancelled:cancel[0].v});
  } catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════ SETTINGS ═══════════
router.get('/settings/accounts', async (req,res) => {
  try { const [r]=await db.query("SELECT u.id,u.fullname,u.email,u.admin_role AS role,COALESCE(s.name,N'Toàn hệ thống') AS branch,u.is_active AS active FROM users u LEFT JOIN stores s ON u.admin_branch_id=s.id WHERE u.is_admin=1 ORDER BY u.id"); res.json(r); }
  catch(err) { res.status(500).json({error:err.message}); }
});
router.get('/settings/audit-logs', async (req,res) => {
  try { const [r]=await db.query('SELECT TOP 100 al.*, u.fullname AS user_name, u.email FROM audit_logs al JOIN users u ON al.user_id=u.id ORDER BY al.created_at DESC'); res.json(r); }
  catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════ NOTIFICATIONS ═══════════
router.get('/notifications', async (req,res) => { try { const [r]=await db.query('SELECT TOP 50 * FROM notifications ORDER BY created_at DESC'); res.json(r); } catch(err){res.status(500).json({error:err.message});} });
router.post('/notifications', async (req,res) => {
  try { const {user_id,type,title,body,link}=req.body; const [r]=await db.query('INSERT INTO notifications (user_id,type,title,body,link) OUTPUT INSERTED.id VALUES (?,?,?,?,?)',[user_id||null,type,title,body||null,link||null]); await logAudit(req.user.sub, 'Gửi thông báo', title, req); res.status(201).json({id:r[0].id,message:'Đã gửi'}); }
  catch(err) { res.status(500).json({error:err.message}); }
});

// ═══════════ TABLES & QR (CRUD) ═══════════
router.get('/tables', async (req, res) => {
  try {
    const [r] = await db.query(
      `SELECT t.id, t.store_id, s.name AS store_name, t.name, t.qr_code_token, t.is_active
       FROM tables t JOIN stores s ON s.id = t.store_id ORDER BY t.store_id, t.id`,
    );
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/tables', async (req, res) => {
  try {
    const { store_id, name } = req.body;
    if (!store_id || !name) return res.status(400).json({ error: 'Thiếu store_id hoặc name' });
    const num = Number((String(name).match(/(\d+)/) || [])[0] || 0);
    const [existing] = await db.query('SELECT name FROM tables WHERE store_id = ?', [store_id]);
    const dup = existing.find(
      (t) => Number((t.name.match(/(\d+)/) || [])[0] || 0) === num && num > 0,
    );
    if (dup) return res.status(400).json({ error: 'Số bàn này đã tồn tại trong chi nhánh' });
    const token = crypto.randomBytes(16).toString('hex');
    const [r] = await db.query(
      'INSERT INTO tables (store_id, name, qr_code_token, is_active) OUTPUT INSERTED.* VALUES (?, ?, ?, 1)',
      [store_id, name, token],
    );
    await logAudit(req.user.sub, 'Tạo vị trí bàn', `${name} (store ${store_id})`, req);
    res.status(201).json(r[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/tables/:id', async (req, res) => {
  try {
    const { name, is_active } = req.body;
    const [cur] = await db.query('SELECT id, store_id, name FROM tables WHERE id = ?', [req.params.id]);
    if (!cur[0]) return res.status(404).json({ error: 'Không tìm thấy bàn' });
    if (name) {
      const num = Number((String(name).match(/(\d+)/) || [])[0] || 0);
      const [existing] = await db.query('SELECT id, name FROM tables WHERE store_id = ?', [cur[0].store_id]);
      const dup = existing.find(
        (t) => t.id !== cur[0].id && Number((t.name.match(/(\d+)/) || [])[0] || 0) === num && num > 0,
      );
      if (dup) return res.status(400).json({ error: 'Số bàn này đã tồn tại trong chi nhánh' });
    }
    await db.query(
      'UPDATE tables SET name = ?, is_active = ? WHERE id = ?',
      [name ?? null, is_active ?? 1, req.params.id],
    );
    await logAudit(req.user.sub, `Cập nhật vị trí bàn #${req.params.id}`, name || '', req);
    res.json({ message: 'Đã cập nhật bàn' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/tables/:id', async (req, res) => {
  try {
    const [, affected] = await db.query('DELETE FROM tables WHERE id = ?', [req.params.id]);
    if (affected === 0) return res.status(404).json({ error: 'Không tìm thấy bàn' });
    await logAudit(req.user.sub, `Xóa vị trí bàn #${req.params.id}`, '', req);
    res.json({ message: 'Đã xóa bàn' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════ PRINT TRACKING ═══════════
router.post('/orders/:id/print', async (req, res) => {
  try {
    const [, affected] = await db.query(
      'UPDATE orders SET is_printed = 1, updated_at = GETDATE() WHERE id = ?',
      [req.params.id],
    );
    if (affected === 0) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    await logAudit(req.user.sub, `In hóa đơn đơn #${req.params.id}`, '', req);
    res.json({ message: 'Đã đánh dấu in hóa đơn' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;

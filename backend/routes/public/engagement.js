import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { validateReviewInput, validateJobApplyInput } from '../../validation/engagement-schemas.js';
import { validateCustomerId } from '../../validation/customer-schemas.js';
import { toReviewDto, toWishlistDto, toJobDto } from '../../dto/engagement-dto.js';
import { toCustomerDto, toNotificationDto } from '../../dto/customer-dto.js';
import engagementService from '../../services/engagement/engagement-service.js';
import recruitmentService from '../../services/recruitment/recruitment-service.js';
import notificationService from '../../services/notifications/notification-service.js';

const router = Router();

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

function requireCustomerNotificationOwner(req, res, next) {
  const requestedId = Number(req.params.id);
  const authUserId = Number(req.user?.id || req.user?.sub);
  if (!authUserId) return res.status(401).json({ error: 'Chưa xác thực người dùng' });
  if (req.user?.role !== 'customer' || requestedId !== authUserId) {
    return res.status(403).json({ error: 'Không có quyền truy cập thông báo của tài khoản này' });
  }
  next();
}

// ═══════════ JOBS, TIERS & REWARDS ═══════════

router.get('/jobs', asyncHandler(async (req, res) => {
  try {
    const rows = await engagementService.listJobs();
    res.json(rows.map(toJobDto));
  } catch (err) {
    console.error('Public jobs read failed:', err.message);
    res.status(500).json({ error: 'Không thể tải tuyển dụng lúc này' });
  }
}));

router.post('/jobs/:id/apply', asyncHandler(async (req, res) => {
  try {
    const validated = validateJobApplyInput(req.body);
    const created = await recruitmentService.applyJob({
      jobId: req.params.id,
      storeId: validated.store_id,
      fullname: validated.fullname,
      phone: validated.phone,
      email: validated.email,
      cvUrl: validated.cv_url,
    });
    res.status(201).json({ id: created.id, message: 'Nộp hồ sơ thành công!' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.get('/tiers', asyncHandler(async (req, res) => {
  try {
    const rows = await engagementService.listTiers();
    res.json(rows);
  } catch (err) {
    console.error('Public tiers read failed:', err.message);
    res.status(500).json({ error: 'Không thể tải hạng thành viên lúc này' });
  }
}));

router.get('/rewards', asyncHandler(async (req, res) => {
  try {
    const rows = await engagementService.listRewards();
    res.json(rows);
  } catch (err) {
    console.error('Public rewards read failed:', err.message);
    res.status(500).json({ error: 'Không thể tải quà đổi thưởng lúc này' });
  }
}));

// ═══════════ USER PROFILE & DATA ═══════════

router.get('/users/:id', authenticate, requireCustomerSelf, asyncHandler(async (req, res) => {
  try {
    const id = validateCustomerId(req.params.id);
    const user = await engagementService.getUserProfile(id);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json(toCustomerDto(user));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.get('/users/:id/wishlist', authenticate, requireCustomerSelf, asyncHandler(async (req, res) => {
  try {
    const id = validateCustomerId(req.params.id);
    const rows = await engagementService.listUserWishlist(id);
    res.json(rows.map(toWishlistDto));
  } catch (err) {
    console.error('Public wishlist read failed:', err.message);
    res.status(500).json({ error: 'Không thể tải danh sách yêu thích lúc này' });
  }
}));

router.post('/users/:id/wishlist/:productId', authenticate, requireCustomerSelf, asyncHandler(async (req, res) => {
  try {
    const id = validateCustomerId(req.params.id);
    const result = await engagementService.toggleUserWishlist(id, req.params.productId);
    const status = result.added ? 201 : 200;
    const message = result.added ? 'Đã thêm vào wishlist' : 'Đã xóa khỏi wishlist';
    res.status(status).json({ added: result.added, message });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.get('/users/:id/notifications', authenticate, requireCustomerNotificationOwner, asyncHandler(async (req, res) => {
  try {
    const id = validateCustomerId(req.user.id || req.user.sub);
    const { notifications, unread_count } = await notificationService.listForUser(id, req.query.limit);
    res.json({
      notifications: notifications.map(toNotificationDto),
      unread_count,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.patch('/users/:id/notifications/:notificationId/read', authenticate, requireCustomerNotificationOwner, asyncHandler(async (req, res) => {
  try {
    const id = validateCustomerId(req.user.id || req.user.sub);
    const result = await notificationService.markOneRead(id, req.params.notificationId);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.post('/users/:id/notifications/read-all', authenticate, requireCustomerNotificationOwner, asyncHandler(async (req, res) => {
  try {
    const id = validateCustomerId(req.user.id || req.user.sub);
    const result = await notificationService.markAllRead(id);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.delete('/users/:id/notifications', authenticate, requireCustomerNotificationOwner, asyncHandler(async (req, res) => {
  try {
    const id = validateCustomerId(req.user.id || req.user.sub);
    const result = await notificationService.clearAll(id);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.get('/users/:id/vouchers', authenticate, requireCustomerSelf, asyncHandler(async (req, res) => {
  try {
    const id = validateCustomerId(req.params.id);
    const rows = await engagementService.listUserVouchers(id);
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

// ═══════════ REVIEWS ═══════════

router.get('/products/:id/reviews', asyncHandler(async (req, res) => {
  try {
    const rows = await engagementService.listProductReviews(req.params.id);
    res.json(rows.map(toReviewDto));
  } catch (err) {
    console.error('Public reviews read failed:', err.message);
    res.status(500).json({ error: 'Không thể tải đánh giá lúc này' });
  }
}));

router.post('/products/:id/reviews', authenticate, asyncHandler(async (req, res) => {
  try {
    const userId = Number(req.user?.id || req.user?.sub);
    const validated = validateReviewInput(req.body);
    const result = await engagementService.createProductReview(userId, {
      productId: req.params.id,
      orderItemId: validated.order_item_id,
      rating: validated.rating,
      comment: validated.comment,
      imageUrls: validated.image_urls,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.message && err.message.includes('uq_review')) {
      return res.status(409).json({ error: 'Bạn đã đánh giá món này rồi' });
    }
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

export default router;

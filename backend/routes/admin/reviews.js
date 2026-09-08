import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { logAudit } from '../../services/audit.js';
import productReviewsService from '../../services/product-reviews-service.js';
import {
  validateAdminReply,
  validateVisibilityChange,
} from '../../validation/product-review-schemas.js';
import { toAdminReviewDto } from '../../dto/product-review-dto.js';

const router = Router();

// =============================================================
// Admin Review Moderation
// =============================================================

/**
 * GET /admin/reviews
 * List reviews with filters (store, visibility, rating).
 */
router.get('/reviews', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  const result = await productReviewsService.listAdminReviews({
    storeId: req.query.store_id ? Number(req.query.store_id) : null,
    visibility: req.query.visibility || null,
    rating: req.query.rating ? Number(req.query.rating) : null,
    cursor: req.query.cursor || null,
    limit: Number(req.query.limit) || 20,
    adminRole: req.user.role,
    adminBranchId: req.user.branch_id,
  });

  res.json({
    items: result.items.map(toAdminReviewDto),
    cursor: result.cursor,
    hasMore: result.hasMore,
  });
}));

/**
 * GET /admin/reviews/:id
 * Get full review detail for admin.
 */
router.get('/reviews/:id', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  const reviewId = Number(req.params.id);
  if (!reviewId) return res.status(400).json({ error: 'ID không hợp lệ' });

  await productReviewsService.checkAdminReviewAccess(reviewId, req.user.role, req.user.branch_id);

  const review = await productReviewsService.getAdminReviewDetail(reviewId);
  if (!review) return res.status(404).json({ error: 'Không tìm thấy đánh giá' });

  res.json(review);
}));

/**
 * POST /admin/reviews/:id/reply
 * Reply to a review (one reply max).
 */
router.post('/reviews/:id/reply', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  const reviewId = Number(req.params.id);
  if (!reviewId) return res.status(400).json({ error: 'ID không hợp lệ' });

  const validation = validateAdminReply(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors.join('; ') });
  }

  // Check branch access
  await productReviewsService.checkAdminReviewAccess(reviewId, req.user.role, req.user.branch_id);

  const reply = await productReviewsService.replyToReview(reviewId, req.user.sub, req.body.body);

  await logAudit(req.user.sub, 'Phản hồi đánh giá', `Review ID: ${reviewId}`, req);

  res.status(201).json(reply);
}));

/**
 * PATCH /admin/reviews/:id/visibility
 * Hide or unhide a review.
 */
router.patch('/reviews/:id/visibility', requireRole('super', 'manager'), asyncHandler(async (req, res) => {
  const reviewId = Number(req.params.id);
  if (!reviewId) return res.status(400).json({ error: 'ID không hợp lệ' });

  const validation = validateVisibilityChange(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors.join('; ') });
  }

  // Check branch access
  await productReviewsService.checkAdminReviewAccess(reviewId, req.user.role, req.user.branch_id);

  const result = await productReviewsService.setReviewVisibility(
    reviewId,
    req.user.sub,
    req.body.visibility,
    req.body.hidden_reason || null,
  );

  await logAudit(
    req.user.sub,
    req.body.visibility === 'hidden' ? 'Ẩn đánh giá' : 'Hiện đánh giá',
    `Review ID: ${reviewId}${req.body.hidden_reason ? ` — Lý do: ${req.body.hidden_reason}` : ''}`,
    req,
  );

  res.json({ visibility: result.visibility_status });
}));

export default router;

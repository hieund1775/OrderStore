import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate } from '../../middleware/auth.js';
import productReviewsService from '../../services/product-reviews-service.js';
import {
  validateCreateReview,
  validateEditReview,
  validateUploadIntent,
  validateReviewListQuery,
} from '../../validation/product-review-schemas.js';
import {
  toPublicReviewDto,
  toCustomerReviewDto,
  toReviewSummaryDto,
} from '../../dto/product-review-dto.js';

const router = Router();

// ─────────────────────────────────────────────────────────
// Public: Product Review Summary & List
// ─────────────────────────────────────────────────────────

/**
 * GET /api/products/:productId/reviews
 * Public: list verified visible reviews for a product.
 */
router.get('/products/:productId/reviews', asyncHandler(async (req, res) => {
  const productId = Number(req.params.productId);
  if (!productId) return res.status(400).json({ error: 'ID sản phẩm không hợp lệ' });

  const queryValidation = validateReviewListQuery(req.query);
  if (!queryValidation.valid) {
    return res.status(400).json({ error: queryValidation.errors.join('; ') });
  }

  const [summary, reviews] = await Promise.all([
    productReviewsService.getProductReviewSummary(productId),
    productReviewsService.listProductReviews(productId, {
      sort: req.query.sort,
      rating: req.query.rating,
      hasMedia: req.query.has_media,
      cursor: req.query.cursor,
      limit: Number(req.query.limit) || 10,
    }),
  ]);

  res.json({
    summary: toReviewSummaryDto(summary),
    reviews: reviews.items.map(toPublicReviewDto),
    cursor: reviews.cursor,
    hasMore: reviews.hasMore,
  });
}));

/**
 * GET /api/orders/:orderCode/items/:orderItemId/review
 * Customer: check eligibility and get own review.
 */
router.get('/orders/:orderCode/items/:orderItemId/review', authenticate, asyncHandler(async (req, res) => {
  const { orderCode } = req.params;
  const orderItemId = Number(req.params.orderItemId);
  const userId = req.user.sub;

  if (!orderItemId) return res.status(400).json({ error: 'ID sản phẩm trong đơn không hợp lệ' });

  // Check customer role
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Chỉ khách hàng mới có thể xem đánh giá' });
  }

  const eligibility = await productReviewsService.checkEligibility(orderCode, orderItemId, userId);

  if (eligibility.eligible) {
    return res.json({
      eligible: true,
      productId: eligibility.productId,
    });
  }

  return res.json({
    eligible: false,
    reason: eligibility.reason,
    review: eligibility.review ? toCustomerReviewDto(eligibility.review) : null,
  });
}));

/**
 * POST /api/review-media/intents
 * Customer: create upload intent for review media.
 */
router.post('/review-media/intents', authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Chỉ khách hàng mới có thể tải media' });
  }

  const validation = validateUploadIntent(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors.join('; ') });
  }

  const intent = await productReviewsService.createUploadIntent({
    userId: req.user.sub,
    action: req.body.action,
    reviewId: req.body.review_id || null,
    orderId: req.body.order_id || null,
    orderItemId: req.body.order_item_id || null,
    mediaType: req.body.media_type,
    contentType: req.body.content_type,
    byteSize: Number(req.body.byte_size),
  });

  res.status(201).json(intent);
}));

/**
 * POST /api/orders/:orderCode/items/:orderItemId/review
 * Customer: create original review.
 */
router.post('/orders/:orderCode/items/:orderItemId/review', authenticate, asyncHandler(async (req, res) => {
  const { orderCode } = req.params;
  const orderItemId = Number(req.params.orderItemId);
  const userId = req.user.sub;

  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Chỉ khách hàng mới có thể đánh giá' });
  }

  if (!orderItemId) return res.status(400).json({ error: 'ID sản phẩm không hợp lệ' });

  const validation = validateCreateReview(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors.join('; ') });
  }

  // First check eligibility
  const eligibility = await productReviewsService.checkEligibility(orderCode, orderItemId, userId);
  if (!eligibility.eligible) {
    return res.status(400).json({ error: eligibility.reason });
  }

  const result = await productReviewsService.createReview({
    userId,
    productId: eligibility.productId,
    orderItemId,
    rating: Number(req.body.rating),
    comment: req.body.comment || null,
    intentIds: req.body.intent_ids || [],
  });

  res.status(201).json({ review: toCustomerReviewDto(result.review) });
}));

/**
 * PATCH /api/reviews/:reviewId
 * Customer: edit review (one-time within window).
 */
router.patch('/reviews/:reviewId', authenticate, asyncHandler(async (req, res) => {
  const reviewId = Number(req.params.reviewId);
  const userId = req.user.sub;

  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Chỉ khách hàng mới có thể chỉnh sửa đánh giá' });
  }

  if (!reviewId) return res.status(400).json({ error: 'ID đánh giá không hợp lệ' });

  const validation = validateEditReview(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.errors.join('; ') });
  }

  const result = await productReviewsService.editReview(reviewId, userId, {
    rating: Number(req.body.rating),
    comment: req.body.comment || null,
    intentIds: req.body.intent_ids || [],
  });

  res.json({ review: toCustomerReviewDto(result.review) });
}));

/**
 * POST /api/products/:id/reviews — LEGACY COMPATIBILITY ADAPTER
 * Thin wrapper that delegates to ProductReviewsService.
 * Does NOT retain a separate auth, eligibility, or insertion path.
 */
router.post('/products/:id/reviews', authenticate, asyncHandler(async (req, res) => {
  const productId = Number(req.params.id);
  const userId = req.user.sub;

  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Chỉ khách hàng mới có thể đánh giá' });
  }

  if (!productId) return res.status(400).json({ error: 'ID sản phẩm không hợp lệ' });

  const { order_item_id, rating, comment } = req.body;
  if (!order_item_id) {
    return res.status(400).json({ error: 'Thiếu order_item_id' });
  }

  // Delegate to new service — find order code from order item
  // The service already handles eligibility, ownership, and dedup checks
  try {
    const result = await productReviewsService.createReview({
      userId,
      productId,
      orderItemId: Number(order_item_id),
      rating: Number(rating),
      comment: comment || null,
      intentIds: [],
    });

    return res.status(201).json({ review: toCustomerReviewDto(result.review) });
  } catch (err) {
    if (err.code === 'DUPLICATE_REVIEW' || err.message?.includes('đã được đánh giá')) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
}));

export default router;
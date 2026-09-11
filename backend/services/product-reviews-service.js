import crypto from 'crypto';
import { ProductReviewsRepository } from '../repositories/postgres/product-reviews.js';
import { IdentityError } from '../repositories/postgres/errors.js';
import { createReviewStorage, verifyObjectMetadata } from './review-storage.js';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1 MiB
const MAX_VIDEO_BYTES = 10 * 1024 * 1024; // 10 MiB
const INTENT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const EDIT_WINDOW_DAYS = 7;

/**
 * Product Reviews Service — domain logic and orchestration.
 */
export class ProductReviewsService {
  /**
   * @param {ProductReviewsRepository} [repo]
   * @param {Object} [storage] - storage adapter (defaults to createReviewStorage())
   */
  constructor(repo, storage) {
    this.repo = repo || new ProductReviewsRepository();
    this.storage = storage || createReviewStorage();
  }

  _assertPreorderReviewEligibility(ownership) {
    if (ownership?.preorder_id != null && ownership.preorder_checked_in_at == null) {
      throw new IdentityError('PREORDER_NOT_CHECKED_IN', 'Preorder must be checked in before review');
    }
  }

  /**
   * Check if a customer can review an order item.
   */
  async checkEligibility(orderCode, orderItemId, userId) {
    const ownership = await this.repo.verifyOrderItemOwnership(orderItemId, userId);
    if (!ownership) {
      return { eligible: false, reason: 'Không tìm thấy sản phẩm trong đơn hàng của bạn' };
    }

    // Check order status
    const status = await this.repo.getLatestOrderStatus(ownership.order_id);
    if (status !== 'Hoàn thành') {
      return { eligible: false, reason: 'Đơn hàng chưa hoàn thành, chưa thể đánh giá' };
    }

    if (ownership.preorder_id != null && ownership.preorder_checked_in_at == null) {
      return { eligible: false, reason: 'Preorder must be checked in before review' };
    }

    // Check existing review
    const existing = await this.repo.findByOrderItemAndUser(orderItemId, userId);
    if (existing) {
      const timeline = await this.repo.getReviewTimeline(existing.id);
      return {
        eligible: false,
        reason: 'Bạn đã đánh giá sản phẩm này',
        review: this._toReviewDto(existing, timeline),
      };
    }

    return {
      eligible: true,
      productId: ownership.product_id,
      orderId: ownership.order_id,
      orderCode: ownership.order_code,
    };
  }

  /**
   * Create an original review after purchase.
   * Before attaching media, verifies each stored object's actual byte size
   * and detected content type via magic bytes.
   */
  async createReview({ userId, productId, orderItemId, rating, comment, intentIds }) {
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      throw new IdentityError('INVALID_RATING', 'Điểm đánh giá phải từ 1 đến 5');
    }

    // Verify ownership and eligibility
    const ownership = await this.repo.verifyOrderItemOwnership(orderItemId, userId);
    if (!ownership) {
      throw new IdentityError('FORBIDDEN', 'Sản phẩm không thuộc đơn hàng của bạn');
    }

    if (Number(productId) !== Number(ownership.product_id)) {
      throw new IdentityError('PRODUCT_MISMATCH', 'Sản phẩm không khớp với sản phẩm đã mua');
    }

    const status = await this.repo.getLatestOrderStatus(ownership.order_id);
    if (status !== 'Hoàn thành') {
      throw new IdentityError('NOT_COMPLETED', 'Đơn hàng chưa hoàn thành');
    }

    this._assertPreorderReviewEligibility(ownership);

    // Verify objects in storage before creating the review
    if (intentIds && intentIds.length > 0) {
      for (const intentId of intentIds) {
        const intent = await this.repo.findUploadIntent(intentId);
        if (!intent) {
          throw new IdentityError('INTENT_NOT_FOUND', `Upload intent ${intentId} không tồn tại`);
        }
        await this._assertIntentScope(intent, {
          userId,
          action: 'create_original',
          orderId: ownership.order_id,
          orderItemId,
        });
        if (intent.claimed_at) {
          throw new IdentityError('INTENT_USED', 'Upload intent đã được sử dụng');
        }
        if (new Date(intent.expires_at) < new Date()) {
          throw new IdentityError('INTENT_EXPIRED', 'Upload intent đã hết hạn');
        }

        // Verify the actual object in storage
        const verification = await this.storage.verifyObject(intent.storage_key);
        if (!verification.found) {
          throw new IdentityError('OBJECT_NOT_FOUND', 'File chưa được upload vào storage');
        }
        if (!verification.valid) {
          throw new IdentityError('INVALID_OBJECT', verification.errors.join('; '));
        }
      }
    }

    const verifiedAt = new Date().toISOString();

    // Create review and revision in transaction
    const { review, revision } = await this.repo.createReview({
      userId,
      productId: ownership.product_id,
      orderItemId,
      rating,
      comment: comment || null,
      verifiedAt,
    });

    // Attach media if any intent ids were provided
    if (intentIds && intentIds.length > 0) {
      for (const intentId of intentIds) {
        const claimed = await this.repo.claimUploadIntent(intentId);
        if (claimed && claimed.owner_user_id === userId) {
          const mediaType = claimed.media_type;
          const verification = await this.storage.verifyObject(claimed.storage_key);
          // Use the detected content type from storage, not the client-submitted one
          const actualContentType = verification.detectedContentType || claimed.requested_content_type;
          const actualByteSize = verification.byteSize || claimed.requested_byte_size;

          await this.repo.attachMedia(revision.id, intentId, {
            storageKey: claimed.storage_key,
            contentType: actualContentType,
            byteSize: actualByteSize,
            mediaType,
          });
        }
      }
    }

    return { review, revision };
  }

  /**
   * Edit a review (one-time customer edit).
   * Before attaching media, verifies each stored object's actual byte size
   * and detected content type via magic bytes.
   */
  async editReview(reviewId, userId, { rating, comment, intentIds }) {
    if (!rating || rating < 1 || rating > 5) {
      throw new IdentityError('INVALID_RATING', 'Điểm đánh giá phải từ 1 đến 5');
    }

    // Verify objects in storage before editing
    if (intentIds && intentIds.length > 0) {
      for (const intentId of intentIds) {
        const intent = await this.repo.findUploadIntent(intentId);
        if (!intent) {
          throw new IdentityError('INTENT_NOT_FOUND', `Upload intent ${intentId} không tồn tại`);
        }
        await this._assertIntentScope(intent, {
          userId,
          action: 'edit_revision',
          reviewId,
        });
        if (intent.claimed_at) {
          throw new IdentityError('INTENT_USED', 'Upload intent đã được sử dụng');
        }
        if (new Date(intent.expires_at) < new Date()) {
          throw new IdentityError('INTENT_EXPIRED', 'Upload intent đã hết hạn');
        }

        const verification = await this.storage.verifyObject(intent.storage_key);
        if (!verification.found) {
          throw new IdentityError('OBJECT_NOT_FOUND', 'File chưa được upload vào storage');
        }
        if (!verification.valid) {
          throw new IdentityError('INVALID_OBJECT', verification.errors.join('; '));
        }
      }
    }

    const { review, revision } = await this.repo.editReview(reviewId, userId, { rating, comment: comment || null });

    // Attach media if any intent ids were provided
    if (intentIds && intentIds.length > 0) {
      for (const intentId of intentIds) {
        const claimed = await this.repo.claimUploadIntent(intentId);
        if (claimed && claimed.owner_user_id === userId) {
          const verification = await this.storage.verifyObject(claimed.storage_key);
          const actualContentType = verification.detectedContentType || claimed.requested_content_type;
          const actualByteSize = verification.byteSize || claimed.requested_byte_size;

          await this.repo.attachMedia(revision.id, intentId, {
            storageKey: claimed.storage_key,
            contentType: actualContentType,
            byteSize: actualByteSize,
            mediaType: claimed.media_type,
          });
        }
      }
    }

    return { review, revision };
  }

  /**
   * Create an upload intent for review media.
   * Returns a signed upload URL from the storage adapter.
   */
  async createUploadIntent({ userId, action, reviewId, orderId, orderItemId, mediaType, contentType, byteSize }) {
    // Validate media type
    const isImage = mediaType === 'image';
    if (isImage) {
      if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
        throw new IdentityError('INVALID_CONTENT_TYPE', 'Chỉ chấp nhận JPEG, PNG, WebP cho ảnh');
      }
      if (byteSize > MAX_IMAGE_BYTES) {
        throw new IdentityError('FILE_TOO_LARGE', 'Ảnh không được vượt quá 1MB');
      }
    } else {
      if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
        throw new IdentityError('INVALID_CONTENT_TYPE', 'Chỉ chấp nhận MP4, WebM cho video');
      }
      if (byteSize > MAX_VIDEO_BYTES) {
        throw new IdentityError('FILE_TOO_LARGE', 'Video không được vượt quá 10MB');
      }
    }

    if (action === 'create_original') {
      if (!orderId || !orderItemId) {
        throw new IdentityError('INVALID_INTENT_SCOPE', 'Review gốc phải gắn với order và order item');
      }
      const ownership = await this.repo.verifyOrderItemOwnership(orderItemId, userId);
      if (!ownership || Number(ownership.order_id) !== Number(orderId)) {
        throw new IdentityError('FORBIDDEN', 'Order item không thuộc đơn hàng của bạn');
      }
      const status = await this.repo.getLatestOrderStatus(ownership.order_id);
      if (status !== 'Hoàn thành') {
        throw new IdentityError('NOT_COMPLETED', 'Đơn hàng chưa hoàn thành');
      }
      this._assertPreorderReviewEligibility(ownership);
      reviewId = null;
    } else {
      if (!reviewId || orderId || orderItemId) {
        throw new IdentityError('INVALID_INTENT_SCOPE', 'Media chỉnh sửa chỉ được gắn với review');
      }
      const reviewContext = await this.repo.getReviewOwnerContext(reviewId);
      if (!reviewContext || Number(reviewContext.user_id) !== Number(userId)) {
        throw new IdentityError('FORBIDDEN', 'Review không thuộc về bạn');
      }
      const review = await this.repo.findById(reviewId);
      if (!review || !review.edit_window_expires_at || new Date(review.edit_window_expires_at) < new Date() || review.customer_edit_used_at) {
        throw new IdentityError('EDIT_EXPIRED', 'Review không còn cửa sổ chỉnh sửa');
      }
      orderId = null;
      orderItemId = null;
    }

    const intentId = crypto.randomUUID();
    const storageKey = `review-media/intents/${intentId}/${mediaType}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + INTENT_EXPIRY_MS).toISOString();

    const intent = await this.repo.createUploadIntent({
      id: intentId,
      ownerUserId: userId,
      action,
      reviewId: reviewId || null,
      orderId: orderId || null,
      orderItemId: orderItemId || null,
      mediaType,
      contentType,
      byteSize,
      storageKey,
      expiresAt,
    });

    // Generate a signed upload URL from the storage adapter
    const { uploadUrl, publicUrl } = await this.storage.createSignedUploadUrl(storageKey, contentType, byteSize);

    return {
      intentId: intent.id,
      storageKey: intent.storage_key,
      uploadUrl,
      publicUrl: publicUrl || null,
      expiresAt: intent.expires_at,
    };
  }

  /**
   * Get a customer's review for an order item with full state.
   */
  async getCustomerReview(orderItemId, userId) {
    const review = await this.repo.getCustomerReview(orderItemId, userId);
    if (!review) return null;

    const timeline = await this.repo.getReviewTimeline(review.id);
    return this._toReviewDto(review, timeline);
  }

  /**
   * List public reviews for a product.
   */
  async listProductReviews(productId, { sort, rating, hasMedia, cursor, limit }) {
    const result = await this.repo.listProductReviews(productId, {
      sort: sort || 'newest',
      rating,
      hasMedia,
      cursor,
      limit: Math.min(limit || 10, 50),
    });

    return {
      items: result.items.map((item) => this._toPublicReviewDto(item)),
      cursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  /**
   * Get product review summary.
   */
  async getProductReviewSummary(productId) {
    return this.repo.getProductReviewSummary(productId);
  }

  /**
   * Admin: list reviews with filters.
   */
  async listAdminReviews({ storeId, visibility, rating, cursor, limit, adminRole, adminBranchId }) {
    // Manager can only see their own store's reviews
    const effectiveStoreId = adminRole === 'manager' ? adminBranchId : storeId;

    return this.repo.listAdminReviews({
      storeId: effectiveStoreId,
      visibility,
      rating,
      cursor,
      limit: Math.min(limit || 20, 100),
    });
  }

  /**
   * Admin: get review detail.
   */
  async getAdminReviewDetail(reviewId) {
    return this.repo.getAdminReviewDetail(reviewId);
  }

  /**
   * Admin: reply to a review.
   */
  async replyToReview(reviewId, adminUserId, body) {
    if (!body || !body.trim()) {
      throw new IdentityError('EMPTY_REPLY', 'Nội dung phản hồi không được để trống');
    }

    return this.repo.replyToReview(reviewId, adminUserId, body.trim());
  }

  /**
   * Admin: set review visibility (hide/unhide).
   */
  async setReviewVisibility(reviewId, adminUserId, visibility, reason) {
    if (!['visible', 'hidden'].includes(visibility)) {
      throw new IdentityError('INVALID_VISIBILITY', 'Trạng thái hiển thị không hợp lệ');
    }

    return this.repo.setVisibility(reviewId, adminUserId, visibility, reason || null);
  }

  /**
   * Check if an admin has permission to act on a review (branch scope).
   */
  async checkAdminReviewAccess(reviewId, adminRole, adminBranchId) {
    if (adminRole === 'super') return true;

    if (adminRole === 'manager') {
      const storeId = await this.repo.getReviewStoreId(reviewId);
      if (storeId !== Number(adminBranchId)) {
        throw new IdentityError('FORBIDDEN', 'Bạn không có quyền quản lý đánh giá này', 403);
      }
      return true;
    }

    throw new IdentityError('FORBIDDEN', 'Bạn không có quyền quản lý đánh giá', 403);
  }

  async _assertIntentScope(intent, expected) {
    if (!intent || Number(intent.owner_user_id) !== Number(expected.userId)) {
      throw new IdentityError('FORBIDDEN', 'Upload intent không thuộc về bạn');
    }
    if (intent.action !== expected.action) {
      throw new IdentityError('INVALID_INTENT_SCOPE', 'Upload intent không đúng hành động');
    }
    if (expected.action === 'create_original') {
      if (Number(intent.order_id) !== Number(expected.orderId) || Number(intent.order_item_id) !== Number(expected.orderItemId) || intent.review_id !== null) {
        throw new IdentityError('INVALID_INTENT_SCOPE', 'Upload intent không đúng order item');
      }
    } else if (Number(intent.review_id) !== Number(expected.reviewId) || intent.order_id !== null || intent.order_item_id !== null) {
      throw new IdentityError('INVALID_INTENT_SCOPE', 'Upload intent không đúng review');
    }
  }

  // ────── DTO helpers ──────

  _toReviewDto(review, timeline) {
    const currentRevision = timeline.revisions?.find((r) => r.id === review.current_revision_id);
    return {
      id: review.id,
      userId: review.user_id,
      productId: review.product_id,
      orderItemId: review.order_item_id,
      rating: currentRevision?.rating || review.current_rating,
      comment: currentRevision?.comment || review.current_comment,
      visibilityStatus: review.visibility_status,
      editWindowExpiresAt: review.edit_window_expires_at,
      customerEditUsedAt: review.customer_edit_used_at,
      purchaseVerifiedAt: review.purchase_verified_at,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
      media: review.media || [],
      reply: review.reply || null,
      timeline: {
        revisions: timeline.revisions || [],
        replies: timeline.replies || [],
      },
    };
  }

  _toPublicReviewDto(item) {
    return {
      id: item.id,
      rating: item.rating,
      comment: item.comment,
      createdAt: item.revision_created_at || item.created_at,
      user: {
        fullname: item.fullname,
      },
      media: item.media || [],
      reply: item.reply
        ? { body: item.reply.body, createdAt: item.reply.created_at }
        : null,
    };
  }
}

export default new ProductReviewsService();

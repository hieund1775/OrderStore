/**
 * Product Review DTOs — ensure safe public/customer/admin shape.
 */

/**
 * Build a public-facing review DTO (no PII, no internal state).
 */
export function toPublicReviewDto(row) {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.revision_created_at || row.created_at,
    user: {
      fullname: row.fullname || 'Người dùng TeaPlus',
    },
    media: (row.media || []).map((m) => ({
      id: m.id,
      mediaType: m.media_type,
      storageKey: m.storage_key,
      contentType: m.content_type,
      byteSize: m.byte_size,
    })),
    reply: row.reply
      ? {
          body: row.reply.body,
          createdAt: row.reply.created_at,
        }
      : null,
  };
}

/**
 * Build a customer-facing review DTO (includes edit state, timeline).
 */
export function toCustomerReviewDto(review) {
  return {
    id: review.id,
    productId: review.productId,
    orderItemId: review.orderItemId,
    rating: review.rating,
    comment: review.comment,
    visibilityStatus: review.visibilityStatus,
    editWindowExpiresAt: review.editWindowExpiresAt,
    customerEditUsedAt: review.customerEditUsedAt,
    purchaseVerifiedAt: review.purchaseVerifiedAt,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    media: (review.media || []).map((m) => ({
      id: m.id,
      mediaType: m.media_type || m.mediaType,
      storageKey: m.storage_key || m.storageKey,
    })),
    reply: review.reply,
    timeline: review.timeline,
  };
}

/**
 * Build an admin-facing review DTO (includes user info, moderation state).
 */
export function toAdminReviewDto(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userFullname: row.user_fullname,
    productId: row.product_id,
    productName: row.product_name,
    productSlug: row.product_slug,
    orderItemId: row.order_item_id,
    rating: row.rating,
    comment: row.comment,
    visibilityStatus: row.visibility_status,
    purchaseVerifiedAt: row.purchase_verified_at,
    hiddenAt: row.hidden_at,
    hiddenBy: row.hidden_by,
    hiddenReason: row.hidden_reason,
    editWindowExpiresAt: row.edit_window_expires_at,
    customerEditUsedAt: row.customer_edit_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reply: row.reply || null,
  };
}

/**
 * Build a review summary DTO for product detail pages.
 */
export function toReviewSummaryDto(summary) {
  return {
    averageRating: Number(summary.average_rating),
    totalReviewCount: summary.total_review_count,
    distribution: {
      5: Number(summary.rating_5),
      4: Number(summary.rating_4),
      3: Number(summary.rating_3),
      2: Number(summary.rating_2),
      1: Number(summary.rating_1),
    },
  };
}
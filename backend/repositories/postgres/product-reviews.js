import postgresDb from '../../config/db-postgres.js';
import { IdentityError, isUniqueViolation } from './errors.js';

/**
 * Product Reviews Repository — Postgres implementation.
 * All queries are parameterized. No raw string interpolation.
 */
export class ProductReviewsRepository {
  /**
   * @param {import('pg').Pool} [db]
   */
  constructor(db) {
    const adapter = db || postgresDb;
    // postgresDb exposes the shared [rows, affectedCount] adapter contract,
    // while this repository also supports native pg.Result clients in tests.
    // Normalize only query results at this boundary.
    this.db = new Proxy(adapter, {
      get(target, property, receiver) {
        if (property !== 'query') return Reflect.get(target, property, receiver);
        return async (...args) => {
          const result = await target.query(...args);
          return Array.isArray(result) ? { rows: result[0], rowCount: result[1] } : result;
        };
      },
    });
  }

  // ────── Reviews ──────

  /**
   * Find a review by id with full join data.
   */
  async findById(reviewId) {
    const { rows } = await this.db.query(
      `SELECT
        r.*,
        rr.rating AS current_rating,
        rr.comment AS current_comment,
        rr.created_at AS revision_created_at,
        u.fullname AS user_fullname,
        p.name AS product_name,
        p.slug AS product_slug
      FROM reviews r
      LEFT JOIN review_revisions rr ON rr.id = r.current_revision_id
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN products p ON p.id = r.product_id
      WHERE r.id = $1`,
      [reviewId],
    );
    return rows[0] || null;
  }

  /**
   * Find a review by order_item_id and user_id.
   */
  async findByOrderItemAndUser(orderItemId, userId) {
    const { rows } = await this.db.query(
      `SELECT * FROM reviews WHERE order_item_id = $1 AND user_id = $2`,
      [orderItemId, userId],
    );
    return rows[0] || null;
  }

  /**
   * Get the latest order status for an order.
   */
  async getLatestOrderStatus(orderId) {
    const { rows } = await this.db.query(
      `SELECT status FROM order_status_history
       WHERE order_id = $1
       ORDER BY id DESC LIMIT 1`,
      [orderId],
    );
    return rows[0]?.status || null;
  }

  /**
   * Check order ownership and verify item belongs to the order.
   */
  async verifyOrderItemOwnership(orderItemId, userId) {
    const { rows } = await this.db.query(
      `SELECT oi.id, oi.order_id, oi.product_id, o.user_id, o.order_code,
              o.preorder_id, p.checked_in_at AS preorder_checked_in_at
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN preorders p ON p.id = o.preorder_id
       WHERE oi.id = $1 AND o.user_id = $2`,
      [orderItemId, userId],
    );
    return rows[0] || null;
  }

  async getReviewOwnerContext(reviewId) {
    const { rows } = await this.db.query(
      `SELECT rev.id AS review_id, rev.user_id, rev.order_item_id,
              oi.order_id, oi.product_id, o.order_code, o.user_id AS order_user_id
       FROM reviews rev
       JOIN order_items oi ON oi.id = rev.order_item_id
       JOIN orders o ON o.id = oi.order_id
       WHERE rev.id = $1`,
      [reviewId],
    );
    return rows[0] || null;
  }

  /**
   * Create a new review with original revision in a transaction.
   * Returns { review, revision }.
   */
  async createReview({ userId, productId, orderItemId, rating, comment, verifiedAt }) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Check for existing verified review on this order_item
      const { rows: existing } = await client.query(
        `SELECT id FROM reviews
         WHERE order_item_id = $1 AND purchase_verified_at IS NOT NULL
         FOR UPDATE`,
        [orderItemId],
      );
      if (existing.length > 0) {
        throw new IdentityError('DUPLICATE_REVIEW', 'Sản phẩm này đã được đánh giá');
      }

      // Check for any existing review (even unverified) by this user on this item
      const { rows: existingAny } = await client.query(
        `SELECT id FROM reviews
         WHERE order_item_id = $1 AND user_id = $2
         FOR UPDATE`,
        [orderItemId, userId],
      );
      if (existingAny.length > 0) {
        throw new IdentityError('DUPLICATE_REVIEW', 'Bạn đã đánh giá sản phẩm này');
      }

      // Create review
      const { rows: reviews } = await client.query(
        `INSERT INTO reviews (user_id, product_id, order_item_id, rating, comment,
          purchase_verified_at, visibility_status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'visible', NOW())
         RETURNING *`,
        [userId, productId, orderItemId, rating, comment, verifiedAt],
      );
      const review = reviews[0];

      // Create original revision
      const { rows: revisions } = await client.query(
        `INSERT INTO review_revisions (review_id, sequence, revision_type, rating, comment)
         VALUES ($1, 1, 'original', $2, $3)
         RETURNING *`,
        [review.id, rating, comment],
      );
      const revision = revisions[0];

      // Point review to current revision
      await client.query(
        `UPDATE reviews SET current_revision_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [revision.id, review.id],
      );
      review.current_revision_id = revision.id;

      // Recompute product aggregate
      await this._recomputeProductRating(client, productId);

      await client.query('COMMIT');
      return { review, revision };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Consume the one-time edit grant and append a customer_edit revision.
   */
  async editReview(reviewId, userId, { rating, comment }) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Lock and check review
      const { rows: reviews } = await client.query(
        `SELECT * FROM reviews WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [reviewId, userId],
      );
      if (reviews.length === 0) {
        throw new IdentityError('NOT_FOUND', 'Không tìm thấy đánh giá');
      }
      const review = reviews[0];

      // Check edit window
      if (!review.edit_window_expires_at || new Date(review.edit_window_expires_at) < new Date()) {
        throw new IdentityError('EDIT_EXPIRED', 'Thời hạn chỉnh sửa đã hết');
      }
      if (review.customer_edit_used_at) {
        throw new IdentityError('EDIT_USED', 'Bạn đã sử dụng quyền chỉnh sửa');
      }

      // Get current max sequence
      const { rows: seqRows } = await client.query(
        `SELECT COALESCE(MAX(sequence), 0) + 1 AS next_seq
         FROM review_revisions WHERE review_id = $1`,
        [reviewId],
      );
      const nextSeq = seqRows[0].next_seq;

      // Create customer_edit revision
      const { rows: revisions } = await client.query(
        `INSERT INTO review_revisions (review_id, sequence, revision_type, rating, comment)
         VALUES ($1, $2, 'customer_edit', $3, $4)
         RETURNING *`,
        [reviewId, nextSeq, rating, comment],
      );
      const revision = revisions[0];

      // Mark edit as used and update pointer
      await client.query(
        `UPDATE reviews
         SET current_revision_id = $1, customer_edit_used_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [revision.id, reviewId],
      );

      await this._recomputeProductRating(client, review.product_id);

      await client.query('COMMIT');
      return { review: { ...review, current_revision_id: revision.id }, revision };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Toggle review visibility (hide/unhide).
   */
  async setVisibility(reviewId, adminUserId, visibility, reason) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const { rows: reviews } = await client.query(
        `SELECT * FROM reviews WHERE id = $1 FOR UPDATE`,
        [reviewId],
      );
      if (reviews.length === 0) {
        throw new IdentityError('NOT_FOUND', 'Không tìm thấy đánh giá');
      }
      const review = reviews[0];

      const updates = {
        visibility_status: visibility,
        updated_at: new Date().toISOString(),
      };

      if (visibility === 'hidden') {
        updates.hidden_at = new Date().toISOString();
        updates.hidden_by = adminUserId;
        updates.hidden_reason = reason || null;
      } else {
        updates.hidden_at = null;
        updates.hidden_by = null;
        updates.hidden_reason = null;
      }

      await client.query(
        `UPDATE reviews
         SET visibility_status = $1,
             hidden_at = $2,
             hidden_by = $3,
             hidden_reason = $4,
             updated_at = $5
         WHERE id = $6`,
        [
          updates.visibility_status,
          updates.hidden_at,
          updates.hidden_by,
          updates.hidden_reason,
          updates.updated_at,
          reviewId,
        ],
      );

      await this._recomputeProductRating(client, review.product_id);

      await client.query('COMMIT');
      return { ...review, ...updates };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Reply to a review (one reply max).
   */
  async replyToReview(reviewId, adminUserId, body) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Check review exists
      const { rows: reviews } = await client.query(
        `SELECT * FROM reviews WHERE id = $1 FOR UPDATE`,
        [reviewId],
      );
      if (reviews.length === 0) {
        throw new IdentityError('NOT_FOUND', 'Không tìm thấy đánh giá');
      }
      const review = reviews[0];

      // Check no existing reply
      const { rows: existingReplies } = await client.query(
        `SELECT id FROM review_replies WHERE review_id = $1`,
        [reviewId],
      );
      if (existingReplies.length > 0) {
        throw new IdentityError('DUPLICATE_REPLY', 'Đánh giá này đã được phản hồi');
      }

      // Create reply
      const { rows: replies } = await client.query(
        `INSERT INTO review_replies (review_id, admin_user_id, body)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [reviewId, adminUserId, body],
      );
      const reply = replies[0];

      // Open 7-day edit window for customer (if not already used)
      if (!review.customer_edit_used_at && !review.edit_window_expires_at) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await client.query(
          `UPDATE reviews SET edit_window_expires_at = $1, updated_at = NOW()
           WHERE id = $2`,
          [expiresAt, reviewId],
        );
      }

      await client.query('COMMIT');
      return reply;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ────── Public reads ──────

  /**
   * List verified visible reviews for a product with cursor pagination.
   */
  async listProductReviews(productId, { sort, rating, hasMedia, cursor, limit = 10 }) {
    const conditions = [
      'rev.product_id = $1',
      'rev.purchase_verified_at IS NOT NULL',
      'rev.visibility_status = \'visible\'',
    ];
    const params = [productId];
    let paramIdx = 2;

    if (rating) {
      conditions.push(`rr.rating = $${paramIdx++}`);
      params.push(Number(rating));
    }

    if (hasMedia) {
      conditions.push(`EXISTS (
        SELECT 1 FROM review_media rm
        WHERE rm.review_revision_id = rr.id
          AND rm.media_type = $${paramIdx++}
      )`);
      params.push(hasMedia);
    }

    let orderClause = 'ORDER BY rev.created_at DESC';
    if (sort === 'rating_desc') orderClause = 'ORDER BY rr.rating DESC, rev.created_at DESC';
    if (sort === 'rating_asc') orderClause = 'ORDER BY rr.rating ASC, rev.created_at DESC';

    if (cursor) {
      conditions.push(`rev.created_at < $${paramIdx++}`);
      params.push(cursor);
    }

    const whereClause = conditions.join(' AND ');

    const { rows } = await this.db.query(
      `SELECT
        rev.id, rev.user_id, rev.product_id, rev.order_item_id,
        rev.purchase_verified_at, rev.visibility_status,
        rev.edit_window_expires_at, rev.customer_edit_used_at,
        rev.created_at, rev.updated_at,
        rr.rating, rr.comment, rr.revision_type, rr.created_at AS revision_created_at,
        u.fullname,
        (SELECT jsonb_agg(jsonb_build_object(
          'id', rm.id,
          'media_type', rm.media_type,
          'storage_key', rm.storage_key,
          'content_type', rm.content_type,
          'byte_size', rm.byte_size
        )) FROM review_media rm WHERE rm.review_revision_id = rr.id) AS media,
        (SELECT jsonb_build_object(
          'id', rp.id,
          'body', rp.body,
          'created_at', rp.created_at
        ) FROM review_replies rp WHERE rp.review_id = rev.id) AS reply
      FROM reviews rev
      JOIN review_revisions rr ON rr.id = rev.current_revision_id
      JOIN users u ON u.id = rev.user_id
      WHERE ${whereClause}
      ${orderClause}
      LIMIT $${paramIdx}`,
      [...params, limit + 1],
    );

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.created_at : null;

    return { items, nextCursor, hasMore };
  }

  /**
   * Get product review summary (average rating, count, distribution).
   */
  async getProductReviewSummary(productId) {
    const { rows } = await this.db.query(
      `SELECT
        COUNT(*)::INTEGER AS total_review_count,
        COALESCE(ROUND(AVG(rr.rating)::numeric, 1), 0) AS average_rating,
        COUNT(*) FILTER (WHERE rr.rating = 5)::INTEGER AS rating_5,
        COUNT(*) FILTER (WHERE rr.rating = 4)::INTEGER AS rating_4,
        COUNT(*) FILTER (WHERE rr.rating = 3)::INTEGER AS rating_3,
        COUNT(*) FILTER (WHERE rr.rating = 2)::INTEGER AS rating_2,
        COUNT(*) FILTER (WHERE rr.rating = 1)::INTEGER AS rating_1
      FROM reviews rev
      JOIN review_revisions rr ON rr.id = rev.current_revision_id
      WHERE rev.product_id = $1
        AND rev.purchase_verified_at IS NOT NULL
        AND rev.visibility_status = 'visible'`,
      [productId],
    );
    return rows[0] || { total_review_count: 0, average_rating: 0, rating_5: 0, rating_4: 0, rating_3: 0, rating_2: 0, rating_1: 0 };
  }

  // ────── Customer reads ──────

  /**
   * Get customer's own review for an order item with full state.
   */
  async getCustomerReview(orderItemId, userId) {
    const { rows } = await this.db.query(
      `SELECT
        rev.*,
        rr.rating AS current_rating,
        rr.comment AS current_comment,
        rr.revision_type,
        rr.created_at AS revision_created_at,
        (SELECT jsonb_agg(jsonb_build_object(
          'id', rm.id,
          'media_type', rm.media_type,
          'storage_key', rm.storage_key
        ) ORDER BY rm.id) FROM review_media rm WHERE rm.review_revision_id = rr.id) AS media,
        (SELECT jsonb_build_object('id', rp.id, 'body', rp.body, 'created_at', rp.created_at)
         FROM review_replies rp WHERE rp.review_id = rev.id) AS reply
      FROM reviews rev
      LEFT JOIN review_revisions rr ON rr.id = rev.current_revision_id
      WHERE rev.order_item_id = $1 AND rev.user_id = $2`,
      [orderItemId, userId],
    );
    return rows[0] || null;
  }

  /**
   * Get review timeline (all revisions + reply).
   */
  async getReviewTimeline(reviewId) {
    const { rows: revisions } = await this.db.query(
      `SELECT id, sequence, revision_type, rating, comment, created_at
       FROM review_revisions
       WHERE review_id = $1
       ORDER BY sequence ASC`,
      [reviewId],
    );

    const { rows: replies } = await this.db.query(
      `SELECT rp.id, rp.body, rp.created_at, u.fullname AS admin_name
       FROM review_replies rp
       JOIN users u ON u.id = rp.admin_user_id
       WHERE rp.review_id = $1`,
      [reviewId],
    );

    return { revisions, replies };
  }

  // ────── Admin reads ──────

  /**
   * List all reviews for admin moderation with filters.
   */
  async listAdminReviews({ storeId, visibility, rating, cursor, limit = 20 }) {
    const conditions = ['1=1'];
    const params = [];
    let paramIdx = 1;

    if (storeId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.id = rev.order_item_id AND o.store_id = $${paramIdx}
      )`);
      params.push(Number(storeId));
      paramIdx++;
    }

    if (visibility) {
      conditions.push(`rev.visibility_status = $${paramIdx++}`);
      params.push(visibility);
    }

    if (rating) {
      conditions.push(`rr.rating = $${paramIdx++}`);
      params.push(Number(rating));
    }

    if (cursor) {
      conditions.push(`rev.id < $${paramIdx++}`);
      params.push(Number(cursor));
    }

    const whereClause = conditions.join(' AND ');

    const { rows } = await this.db.query(
      `SELECT
        rev.id, rev.user_id, rev.product_id, rev.order_item_id,
        rev.purchase_verified_at, rev.visibility_status,
        rev.hidden_at, rev.hidden_by, rev.hidden_reason,
        rev.edit_window_expires_at, rev.customer_edit_used_at,
        rev.created_at, rev.updated_at,
        rr.rating, rr.comment, rr.revision_type, rr.created_at AS revision_created_at,
        u.fullname AS user_fullname,
        p.name AS product_name, p.slug AS product_slug,
        (SELECT jsonb_build_object('id', rp.id, 'body', rp.body, 'created_at', rp.created_at)
         FROM review_replies rp WHERE rp.review_id = rev.id) AS reply
      FROM reviews rev
      LEFT JOIN review_revisions rr ON rr.id = rev.current_revision_id
      LEFT JOIN users u ON u.id = rev.user_id
      LEFT JOIN products p ON p.id = rev.product_id
      WHERE ${whereClause}
      ORDER BY rev.id DESC
      LIMIT $${paramIdx}`,
      [...params, limit + 1],
    );

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return { items, cursor: hasMore ? String(items[items.length - 1].id) : null, hasMore };
  }

  /**
   * Get admin review detail.
   */
  async getAdminReviewDetail(reviewId) {
    const review = await this.findById(reviewId);
    if (!review) return null;

    const timeline = await this.getReviewTimeline(reviewId);
    return { ...review, ...timeline };
  }

  /**
   * Get the store_id of the order that purchased the reviewed item.
   */
  async getReviewStoreId(reviewId) {
    const { rows } = await this.db.query(
      `SELECT o.store_id
       FROM reviews rev
       JOIN order_items oi ON oi.id = rev.order_item_id
       JOIN orders o ON o.id = oi.order_id
       WHERE rev.id = $1`,
      [reviewId],
    );
    return rows[0]?.store_id || null;
  }

  // ────── Media upload intents ──────

  /**
   * Create an upload intent for review media.
   */
  async createUploadIntent({ id, ownerUserId, action, reviewId, orderId, orderItemId, mediaType, contentType, byteSize, storageKey, expiresAt }) {
    const { rows } = await this.db.query(
      `INSERT INTO review_media_uploads
        (id, owner_user_id, action, review_id, order_id, order_item_id,
         media_type, requested_content_type, requested_byte_size, storage_key, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [id, ownerUserId, action, reviewId || null, orderId || null, orderItemId || null,
       mediaType, contentType, byteSize, storageKey, expiresAt],
    );
    return rows[0];
  }

  /**
   * Find an upload intent by id (for pre-verification).
   */
  async findUploadIntent(intentId) {
    const { rows } = await this.db.query(
      `SELECT * FROM review_media_uploads WHERE id = $1`,
      [intentId],
    );
    return rows[0] || null;
  }

  /**
   * Claim and attach an upload intent.
   */
  async claimUploadIntent(intentId) {
    const { rows } = await this.db.query(
      `UPDATE review_media_uploads
       SET claimed_at = NOW()
       WHERE id = $1 AND claimed_at IS NULL
       RETURNING *`,
      [intentId],
    );
    return rows[0] || null;
  }

  /**
   * Attach media to a revision, marking intent as attached.
   */
  async attachMedia(revisionId, intentId, { storageKey, contentType, byteSize, mediaType }) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Check media limit per revision
      const { rows: existingMedia } = await client.query(
        `SELECT media_type FROM review_media WHERE review_revision_id = $1`,
        [revisionId],
      );
      const existingTypes = new Set(existingMedia.map((m) => m.media_type));
      if (existingTypes.has(mediaType)) {
        throw new IdentityError('MEDIA_LIMIT', `Đã có ${mediaType === 'image' ? 'ảnh' : 'video'} cho phiên bản này`);
      }

      // Insert media
      const { rows: media } = await client.query(
        `INSERT INTO review_media (review_revision_id, media_type, storage_key, content_type, byte_size)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [revisionId, mediaType, storageKey, contentType, byteSize],
      );

      // Mark intent as attached
      await client.query(
        `UPDATE review_media_uploads SET attached_at = NOW() WHERE id = $1`,
        [intentId],
      );

      await client.query('COMMIT');
      return media[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ────── Helpers ──────

  /**
   * Recompute product rating and review_count from visible verified reviews.
   */
  async _recomputeProductRating(client, productId) {
    await client.query(
      `UPDATE products p
       SET
         rating = COALESCE((
           SELECT ROUND(AVG(rr.rating)::numeric, 1)
           FROM reviews rev
           JOIN review_revisions rr ON rr.id = rev.current_revision_id
           WHERE rev.product_id = p.id
             AND rev.purchase_verified_at IS NOT NULL
             AND rev.visibility_status = 'visible'
         ), 0),
         review_count = (
           SELECT COUNT(*)
           FROM reviews rev
           WHERE rev.product_id = p.id
             AND rev.purchase_verified_at IS NOT NULL
             AND rev.visibility_status = 'visible'
         )
       WHERE p.id = $1`,
      [productId],
    );
  }
}

export default new ProductReviewsRepository();

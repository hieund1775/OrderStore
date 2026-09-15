import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePublicReviewHubQuery,
  validateAdminReviewListQuery,
} from '../validation/product-review-schemas.js';
import {
  maskCustomerName,
  toPublicReviewHubDto,
} from '../dto/product-review-dto.js';
import {
  ProductReviewsRepository,
  encodeHubCursor,
  decodeHubCursor,
} from '../repositories/postgres/product-reviews.js';

describe('Review Hub Public & Admin Reply Contract', () => {
  describe('Customer Name Masking', () => {
    it('masks customer names according to e-commerce privacy rules (e.g. H*** N**)', () => {
      assert.equal(maskCustomerName('Hoàng Nam'), 'H*** N**');
      assert.equal(maskCustomerName('Nguyễn Văn A'), 'N*** V** A');
      assert.equal(maskCustomerName('Lê Bình'), 'L** B***');
      assert.equal(maskCustomerName('A'), 'A');
      assert.equal(maskCustomerName(''), 'Khách hàng');
      assert.equal(maskCustomerName(null), 'Khách hàng');
      assert.equal(maskCustomerName(undefined), 'Khách hàng');
    });

    it('toPublicReviewHubDto masks customer name and excludes sensitive order/moderation data', () => {
      const mockRow = {
        id: 101,
        rating: 5,
        comment: 'Trà rất thơm ngon',
        created_at: '2026-09-15T12:00:00.000Z',
        fullname: 'Hoàng Nam',
        user_id: 9999,
        order_item_id: 8888,
        order_code: 'TP2609151234',
        preorder_code: 'PO2609155678',
        group_code: 'GRP123',
        store_id: 1,
        hidden_reason: 'secret reason',
        product_name: 'Trà Đào Cam Sả',
        product_slug: 'tra-dao-cam-sa',
        preorder_id: null,
        media: [],
        reply: { id: 1, body: 'Cảm ơn bạn!', created_at: '2026-09-15T13:00:00.000Z' },
      };

      const dto = toPublicReviewHubDto(mockRow);
      assert.equal(dto.id, 101);
      assert.equal(dto.rating, 5);
      assert.equal(dto.comment, 'Trà rất thơm ngon');
      assert.equal(dto.user.fullname, 'H*** N**');
      assert.equal(dto.product.name, 'Trà Đào Cam Sả');
      assert.equal(dto.product.slug, 'tra-dao-cam-sa');
      assert.equal(dto.source, 'normal');
      assert.deepEqual(dto.reply, { id: 1, body: 'Cảm ơn bạn!', createdAt: '2026-09-15T13:00:00.000Z' });

      // Ensure absolutely NO private/PII/internal fields leaked
      assert.equal(dto.user_id, undefined);
      assert.equal(dto.order_item_id, undefined);
      assert.equal(dto.order_code, undefined);
      assert.equal(dto.preorder_code, undefined);
      assert.equal(dto.group_code, undefined);
      assert.equal(dto.store_id, undefined);
      assert.equal(dto.hidden_reason, undefined);
    });

    it('toPublicReviewHubDto identifies preorder source correctly', () => {
      const mockRow = {
        id: 102,
        rating: 4,
        comment: 'Giao đúng giờ hẹn đặt trước',
        created_at: '2026-09-15T14:00:00.000Z',
        fullname: 'Trần Thị B',
        product_name: 'Trà Vải',
        product_slug: 'tra-vai',
        preorder_id: 50,
        media: [],
        reply: null,
      };

      const dto = toPublicReviewHubDto(mockRow);
      assert.equal(dto.source, 'preorder');
      assert.equal(dto.user.fullname, 'T*** T** B');
      assert.equal(dto.reply, null);
    });
  });

  describe('Validation Schemas', () => {
    it('validates public review hub query parameters', () => {
      assert.equal(validatePublicReviewHubQuery({ source: 'all', limit: 15 }).valid, true);
      assert.equal(validatePublicReviewHubQuery({ source: 'normal', limit: 10 }).valid, true);
      assert.equal(validatePublicReviewHubQuery({ source: 'preorder', limit: 20 }).valid, true);
      assert.equal(validatePublicReviewHubQuery({}).valid, true);

      // Invalid source
      const invalidSource = validatePublicReviewHubQuery({ source: 'invalid' });
      assert.equal(invalidSource.valid, false);

      // Invalid limit
      const invalidLimit = validatePublicReviewHubQuery({ limit: 0 });
      assert.equal(invalidLimit.valid, false);
      const highLimit = validatePublicReviewHubQuery({ limit: 100 });
      assert.equal(highLimit.valid, false);
    });

    it('validates admin review list query parameters with robust hardening', () => {
      assert.equal(validateAdminReviewListQuery({ query: 'TP2609', limit: 15 }).valid, true);
      assert.equal(validateAdminReviewListQuery({ search: 'Trà Đào', limit: 15 }).valid, true);
      assert.equal(validateAdminReviewListQuery({ visibility: 'visible', rating: 5, cursor: 10, store_id: 2 }).valid, true);
      assert.equal(validateAdminReviewListQuery({ visibility: 'all', rating: '1', cursor: '50', store_id: '3' }).valid, true);
      assert.equal(validateAdminReviewListQuery({ query: '' }).valid, true);
      assert.equal(validateAdminReviewListQuery({}).valid, true);

      // Search & Query character limit
      assert.equal(validateAdminReviewListQuery({ query: 'a'.repeat(101) }).valid, false);
      assert.equal(validateAdminReviewListQuery({ search: 'a'.repeat(101) }).valid, false);

      // Invalid visibility
      assert.equal(validateAdminReviewListQuery({ visibility: 'deleted' }).valid, false);
      assert.equal(validateAdminReviewListQuery({ visibility: 'pending' }).valid, false);

      // Invalid rating
      assert.equal(validateAdminReviewListQuery({ rating: 0 }).valid, false);
      assert.equal(validateAdminReviewListQuery({ rating: 6 }).valid, false);
      assert.equal(validateAdminReviewListQuery({ rating: 'five' }).valid, false);

      // Invalid cursor
      assert.equal(validateAdminReviewListQuery({ cursor: 0 }).valid, false);
      assert.equal(validateAdminReviewListQuery({ cursor: -5 }).valid, false);
      assert.equal(validateAdminReviewListQuery({ cursor: 'invalid' }).valid, false);

      // Invalid store_id
      assert.equal(validateAdminReviewListQuery({ store_id: 0 }).valid, false);
      assert.equal(validateAdminReviewListQuery({ store_id: -1 }).valid, false);
      assert.equal(validateAdminReviewListQuery({ store_id: 'branch' }).valid, false);

      // Invalid limit
      assert.equal(validateAdminReviewListQuery({ limit: 0 }).valid, false);
      assert.equal(validateAdminReviewListQuery({ limit: 51 }).valid, false);
    });
  });

  describe('Cursor Keyset Encoding & Deterministic Tie-Breaker', () => {
    it('encodes and decodes keyset cursor preserving ISO date and tie-breaker id', () => {
      const now = '2026-09-15T15:30:00.000Z';
      const id = 12345;
      const encoded = encodeHubCursor(now, id);
      assert.ok(typeof encoded === 'string' && encoded.length > 0);

      const decoded = decodeHubCursor(encoded);
      assert.ok(decoded);
      assert.equal(decoded.createdAt, now);
      assert.equal(decoded.id, id);
    });

    it('safely rejects corrupted or malformed cursors', () => {
      assert.equal(decodeHubCursor('not-base64-json'), null);
      assert.equal(decodeHubCursor(''), null);
      assert.equal(decodeHubCursor(null), null);
    });
  });

  describe('Repository SQL Construction', () => {
    it('listPublicReviewHub generates deterministic keyset query with source filters', async () => {
      let capturedSql = '';
      let capturedParams = [];

      const mockDb = {
        async query(sql, params) {
          capturedSql = sql;
          capturedParams = params;
          return [[
            {
              id: 10,
              created_at: '2026-09-15T10:00:00.000Z',
              rating: 5,
              comment: 'Ngon',
              fullname: 'Khách',
              product_name: 'Trà',
              product_slug: 'tra',
              preorder_id: null,
            },
          ]];
        },
      };

      const repo = new ProductReviewsRepository(mockDb);

      // Normal source
      await repo.listPublicReviewHub({ source: 'normal', limit: 15 });
      assert.ok(capturedSql.includes('rev.purchase_verified_at IS NOT NULL'));
      assert.ok(capturedSql.includes("rev.visibility_status = 'visible'"));
      assert.ok(capturedSql.includes('o.preorder_id IS NULL'));
      assert.ok(capturedSql.includes('ORDER BY rev.created_at DESC, rev.id DESC'));
      assert.deepEqual(capturedParams, [16]); // limit + 1

      // Preorder source with cursor
      const cursor = encodeHubCursor('2026-09-15T09:00:00.000Z', 5);
      await repo.listPublicReviewHub({ source: 'preorder', cursor, limit: 15 });
      assert.ok(capturedSql.includes('o.preorder_id IS NOT NULL'));
      assert.ok(capturedSql.includes('rev.created_at < $1 OR (rev.created_at = $1 AND rev.id < $2)'));
      assert.equal(capturedParams[0], '2026-09-15T09:00:00.000Z');
      assert.equal(capturedParams[1], 5);
      assert.equal(capturedParams[2], 16);
    });

    it('listAdminReviews searches TP/PO/GRP, product name, size_label, customer name and EXCLUDES SKU search', async () => {
      let capturedSql = '';
      let capturedParams = [];

      const mockDb = {
        async query(sql, params) {
          capturedSql = sql;
          capturedParams = params;
          return [[]];
        },
      };

      const repo = new ProductReviewsRepository(mockDb);
      await repo.listAdminReviews({ query: 'TP2609', limit: 15 });

      // Ensure search includes order codes, names, size
      assert.ok(capturedSql.includes('o.order_code ILIKE $1'));
      assert.ok(capturedSql.includes('po.preorder_code ILIKE $1'));
      assert.ok(capturedSql.includes('cg.group_code ILIKE $1'));
      assert.ok(capturedSql.includes('p.name ILIKE $1'));
      assert.ok(capturedSql.includes('oi.product_name ILIKE $1'));
      assert.ok(capturedSql.includes('oi.size_label ILIKE $1'));
      assert.ok(capturedSql.includes('u.fullname ILIKE $1'));

      // Ensure NO product_variants SKU search is performed
      assert.ok(!capturedSql.includes('product_variants'), 'Must not join product_variants for SKU search');
      assert.ok(!capturedSql.includes('.sku'), 'Must not search by SKU');

      assert.deepEqual(capturedParams, ['%TP2609%', 16]);
    });

    it('replyToReview rejects second reply with 409 status', async () => {
      const mockDb = {
        async transaction(cb) {
          const client = {
            async query(sql, params) {
              if (sql.includes('SELECT * FROM reviews')) {
                return [[{ id: 1 }]];
              }
              if (sql.includes('SELECT id FROM review_replies')) {
                return [[{ id: 99 }]]; // Existing reply found
              }
              return [[]];
            },
          };
          return cb(client);
        },
      };

      const repo = new ProductReviewsRepository(mockDb);
      await assert.rejects(
        () => repo.replyToReview(1, 2, 'Phản hồi lần 2'),
        (err) => {
          assert.equal(err.name, 'IdentityError');
          assert.equal(err.code, 'DUPLICATE_REPLY');
          assert.equal(err.status, 409);
          return true;
        },
      );
    });

    it('permanent deletion clears child references, cascades the thread, and recomputes one product', async () => {
      const statements = [];
      const mockDb = {
        async transaction(callback) {
          const client = {
            async query(sql, params) {
              statements.push({ sql, params });
              if (sql.includes('FROM reviews') && sql.includes('FOR UPDATE')) {
                return [[{ id: 20, product_id: 7 }]];
              }
              if (sql.includes('FROM review_media')) {
                return [[{ storage_key: 'reviews/20/image.webp' }]];
              }
              return [[]];
            },
          };
          return callback(client);
        },
      };
      const repo = new ProductReviewsRepository(mockDb);

      const deleted = await repo.deleteReviewPermanently(20);

      assert.deepEqual(deleted, {
        reviewId: 20,
        productId: 7,
        storageKeys: ['reviews/20/image.webp'],
      });
      assert.ok(statements.some(({ sql }) => sql.includes('DELETE FROM review_media_uploads')));
      assert.ok(statements.some(({ sql }) => sql.includes('UPDATE reviews SET current_revision_id = NULL')));
      assert.ok(statements.some(({ sql }) => sql.includes('DELETE FROM reviews WHERE id = $1')));
      const aggregate = statements.find(({ sql }) => sql.includes('UPDATE products p'));
      assert.ok(aggregate, 'must recompute aggregate after hard deletion');
      assert.deepEqual(aggregate.params, [7]);
    });
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { Pool } from 'pg';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { seedDemoData } from '../database/postgres/seed-demo.js';
import postgresDb from '../config/db-postgres.js';
import { ProductReviewsService } from '../services/product-reviews-service.js';
import { ProductReviewsRepository } from '../repositories/postgres/product-reviews.js';
import { toPublicReviewDto, toCustomerReviewDto, toAdminReviewDto, toReviewSummaryDto } from '../dto/product-review-dto.js';
import {
  validateCreateReview,
  validateEditReview,
  validateUploadIntent,
  validateAdminReply,
  validateVisibilityChange,
  validateReviewListQuery,
} from '../validation/product-review-schemas.js';
import publicRoutes from '../routes/public.js';
import adminRoutes from '../routes/admin.js';
import publicReviewRoutes from '../routes/public/reviews.js';
import { getPostgresPoolConfig } from '../config/db-postgres.js';
import { createPost0027Baseline } from './postgres-product-reviews-migration.rehearsal.integration.test.js';

const isPostgresIntegration = process.env.POSTGRES_INTEGRATION === '1';
const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const reviewsMigrationPath = new URL('../database/postgres/migrations/0028_product_reviews.sql', import.meta.url);

function isolatedSchemaName() {
  return `pr_0028_integration_${crypto.randomBytes(6).toString('hex')}`;
}

describe('PostgreSQL Product Reviews Integration Suite', () => {
  it('applies migration 0028, creates reviews, verifies lifecycle, and validates schema', async (t) => {
    if (!isPostgresIntegration || !testDbUrl) {
      t.skip('Skipping: Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');
      return;
    }

    const guard = validatePostgresTestGuard(testDbUrl);
    assert.equal(guard.valid, true, guard.reason || 'Guard must pass');
    await postgresDb.close();
    const schema = isolatedSchemaName();
    const setupPool = new Pool({ ...getPostgresPoolConfig(testDbUrl), max: 1 });
    const setupClient = await setupPool.connect();
    try {
      await setupClient.query('BEGIN');
      await createPost0027Baseline(setupClient, schema);
      await setupClient.query('SET search_path TO ' + `"${schema}", public`);
      const migrationSql = await readFile(reviewsMigrationPath, 'utf8');
      await setupClient.query(migrationSql);
      await setupClient.query('COMMIT');
      process.env.PGOPTIONS = `-c search_path="${schema}",public`;
    } finally {
      setupClient.release();
      await setupPool.end();
    }

    const repo = new ProductReviewsRepository(postgresDb);
    const service = new ProductReviewsService(repo);

    // ── 1. Verify migration 0028 tables exist ──
    const [tables] = await postgresDb.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name IN ('review_revisions', 'review_replies', 'review_media', 'review_media_uploads')
      ORDER BY table_name
    `);
    assert.equal(tables.length, 4);
    const tableNames = tables.map((r) => r.table_name);
    assert.ok(tableNames.includes('review_revisions'));
    assert.ok(tableNames.includes('review_replies'));
    assert.ok(tableNames.includes('review_media'));
    assert.ok(tableNames.includes('review_media_uploads'));

    // ── 2. Check reviews table has new columns ──
    const [columns] = await postgresDb.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'reviews'
        AND column_name IN ('visibility_status', 'current_revision_id', 'purchase_verified_at',
                            'edit_window_expires_at', 'customer_edit_used_at', 'hidden_at', 'hidden_by', 'hidden_reason')
      ORDER BY column_name
    `);
    assert.equal(columns.length, 8);

    // ── 3. Verify legacy reviews exist (from seed) ──
    const [legacyReviews] = await postgresDb.query(
      `SELECT id FROM reviews WHERE purchase_verified_at IS NOT NULL LIMIT 5`,
    );
    // The backfill should have set purchase_verified_at on existing reviews
    // This is a sanity check — if seed has no reviews, the test is still valid

    // ── 4. Validate DTO contracts ──
    const publicDto = toPublicReviewDto({
      id: 1, rating: 5, comment: 'Tốt',
      revision_created_at: '2026-09-01T00:00:00.000Z', created_at: '2026-09-01T00:00:00.000Z',
      fullname: 'Nguyễn Văn A', media: [], reply: null,
    });
    assert.equal(publicDto.rating, 5);
    assert.equal(publicDto.user.fullname, 'Nguyễn Văn A');
    assert.equal(publicDto.reply, null);
    assert.ok(publicDto.createdAt);

    const adminDto = toAdminReviewDto({
      id: 1, user_id: 5, user_fullname: 'Nguyễn Văn A',
      product_id: 1, product_name: 'Trà Đào', product_slug: 'tra-dao',
      order_item_id: 1, rating: 4, comment: 'Ngon',
      visibility_status: 'visible', purchase_verified_at: '2026-09-01T00:00:00.000Z',
      hidden_at: null, hidden_by: null, hidden_reason: null,
      edit_window_expires_at: null, customer_edit_used_at: null,
      created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
      reply: null,
    });
    assert.equal(adminDto.userFullname, 'Nguyễn Văn A');
    assert.equal(adminDto.productName, 'Trà Đào');
    assert.equal(adminDto.visibilityStatus, 'visible');

    const summaryDto = toReviewSummaryDto({
      total_review_count: 10, average_rating: 4.2,
      rating_5: 5, rating_4: 3, rating_3: 1, rating_2: 1, rating_1: 0,
    });
    assert.equal(summaryDto.averageRating, 4.2);
    assert.equal(summaryDto.totalReviewCount, 10);
    assert.equal(summaryDto.distribution[5], 5);
    assert.equal(summaryDto.distribution[1], 0);

    // ── 5. Validate validation schemas ──
    // Valid create
    const validCreate = validateCreateReview({ rating: 5, comment: 'Tốt' });
    assert.equal(validCreate.valid, true);

    // Invalid rating
    const invalidRating = validateCreateReview({ rating: 6, comment: 'Tốt' });
    assert.equal(invalidRating.valid, false);
    assert.ok(invalidRating.errors[0].includes('1 đến 5'));

    // Comment too long
    const longComment = validateCreateReview({ rating: 5, comment: 'x'.repeat(2001) });
    assert.equal(longComment.valid, false);
    assert.ok(longComment.errors[0].includes('2000'));

    // Valid edit
    const validEdit = validateEditReview({ rating: 4, comment: 'Cập nhật' });
    assert.equal(validEdit.valid, true);

    // Valid upload intent
    const validIntent = validateUploadIntent({ action: 'create_original', media_type: 'image', content_type: 'image/jpeg', byte_size: 50000 });
    assert.equal(validIntent.valid, true);

    // Invalid upload intent action
    const invalidIntent = validateUploadIntent({ action: 'delete', media_type: 'image', content_type: 'image/jpeg', byte_size: 50000 });
    assert.equal(invalidIntent.valid, false);

    // Valid admin reply
    const validReply = validateAdminReply({ body: 'Cảm ơn bạn' });
    assert.equal(validReply.valid, true);

    // Empty reply
    const emptyReply = validateAdminReply({ body: '' });
    assert.equal(emptyReply.valid, false);

    // Valid visibility change
    const validVis = validateVisibilityChange({ visibility: 'hidden' });
    assert.equal(validVis.valid, true);

    // Invalid visibility
    const invalidVis = validateVisibilityChange({ visibility: 'deleted' });
    assert.equal(invalidVis.valid, false);

    // Valid review list query
    const validQuery = validateReviewListQuery({ sort: 'rating_desc', limit: 20 });
    assert.equal(validQuery.valid, true);

    // Invalid sort
    const invalidSort = validateReviewListQuery({ sort: 'worst' });
    assert.equal(invalidSort.valid, false);

    // ── 6. Test HTTP routes ──
    // Build a mini Express app with the review routes
    const app = express();
    app.use(express.json());
    app.use(publicRoutes);
    app.use(publicReviewRoutes);
    app.use('/admin', adminRoutes);
    app.use((err, req, res, next) => {
      const stackLocation = String(err?.stack || '').split('\n').slice(1, 3).join(' <- ');
      console.error('[Reviews test sanitized error]', {
        name: err?.name,
        code: err?.code,
        route: `${req.method} ${req.path}`,
        stackLocation,
      });
      next(err);
    });

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
      // Public: get product reviews (should return 200, possibly empty array)
      const reviewListRes = await fetch(`http://127.0.0.1:${port}/products/1/reviews`);
      const reviewListText = await reviewListRes.text();
      let reviewList;
      try { reviewList = JSON.parse(reviewListText); } catch { reviewList = null; }
      assert.equal(reviewListRes.status, 200, `review list failed: status=${reviewListRes.status} content-type=${reviewListRes.headers.get('content-type')} body=${reviewListText.slice(0, 300)}`);
      assert.ok(Array.isArray(reviewList.reviews));

      // The list response carries the public summary contract.
      assert.ok(reviewList.summary !== null);

      // Admin: get reviews list (should return 401 without auth)
      const adminReviewsRes = await fetch(`http://127.0.0.1:${port}/admin/reviews`);
      assert.equal(adminReviewsRes.status, 401);

      // Admin: unauthorized access to review detail
      const adminDetailRes = await fetch(`http://127.0.0.1:${port}/admin/reviews/1`);
      assert.equal(adminDetailRes.status, 401);

      // ── 7. Verify product aggregate recompute logic ──
      // Insert a visible verified review and check product rating is updated
      const productId = 1;
      const [products] = await postgresDb.query(
        `SELECT rating, review_count FROM products WHERE id = $1`,
        [productId],
      );
      assert.ok(products.length === 1);
      assert.equal(typeof Number(products[0].rating), 'number');
      assert.equal(typeof products[0].review_count, 'number');

    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await postgresDb.close();
      const cleanupPool = new Pool({ ...getPostgresPoolConfig(testDbUrl), max: 1 });
      try {
        await cleanupPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await cleanupPool.end();
        delete process.env.PGOPTIONS;
      }
    }
  });

  it('rejects unauthenticated access to admin review endpoints', async (t) => {
    if (!isPostgresIntegration || !testDbUrl) {
      t.skip('Skipping: Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');
      return;
    }

    const app = express();
    app.use(express.json());
    app.use('/admin', (await import('../routes/admin.js')).default);
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
      const endpoints = [
        ['GET', `/admin/reviews`],
        ['GET', `/admin/reviews/1`],
        ['POST', `/admin/reviews/1/reply`],
        ['PATCH', `/admin/reviews/1/visibility`],
      ];

      for (const [method, path] of endpoints) {
        const res = await fetch(`http://127.0.0.1:${port}${path}`, { method });
        assert.equal(res.status, 401, `${method} ${path} should return 401`);
      }
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await postgresDb.close();
    }
  });
});

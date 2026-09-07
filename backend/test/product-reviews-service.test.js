import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ProductReviewsService } from '../services/product-reviews-service.js';
import { IdentityError } from '../repositories/postgres/errors.js';
import { FakeReviewStorage } from '../services/review-storage.js';

/**
 * Factory: returns a minimal mock repository that satisfies the service surface.
 * Override any method by passing overrides.
 */
function mockRepo(overrides = {}) {
  const defaults = {
    verifyOrderItemOwnership: mock.fn(),
    getLatestOrderStatus: mock.fn(),
    findByOrderItemAndUser: mock.fn(),
    createReview: mock.fn(),
    editReview: mock.fn(),
    createUploadIntent: mock.fn(),
    findUploadIntent: mock.fn(),
    claimUploadIntent: mock.fn(),
    attachMedia: mock.fn(),
    getCustomerReview: mock.fn(),
    getReviewTimeline: mock.fn(),
    listProductReviews: mock.fn(),
    getProductReviewSummary: mock.fn(),
    listAdminReviews: mock.fn(),
    getAdminReviewDetail: mock.fn(),
    replyToReview: mock.fn(),
    setVisibility: mock.fn(),
    getReviewStoreId: mock.fn(),
  };
  return { ...defaults, ...overrides };
}

describe('ProductReviewsService — unit tests', () => {

  // ────── checkEligibility ──────

  it('returns eligible:false when order item ownership not found', async () => {
    const repo = mockRepo();
    repo.verifyOrderItemOwnership.mock.mockImplementation(() => null);
    const service = new ProductReviewsService(repo);

    const result = await service.checkEligibility('TP001', 1, 5);
    assert.equal(result.eligible, false);
    assert.ok(result.reason.includes('Không tìm thấy'));
  });

  it('returns eligible:false when order is not completed', async () => {
    const repo = mockRepo();
    repo.verifyOrderItemOwnership.mock.mockImplementation(() => ({ order_id: 10, product_id: 1, order_code: 'TP001' }));
    repo.getLatestOrderStatus.mock.mockImplementation(() => 'Đang chuẩn bị');
    const service = new ProductReviewsService(repo);

    const result = await service.checkEligibility('TP001', 1, 5);
    assert.equal(result.eligible, false);
    assert.ok(result.reason.includes('chưa hoàn thành'));
  });

  it('returns eligible:true for a completed order with no existing review', async () => {
    const repo = mockRepo();
    repo.verifyOrderItemOwnership.mock.mockImplementation(() => ({ order_id: 10, product_id: 1, order_code: 'TP001' }));
    repo.getLatestOrderStatus.mock.mockImplementation(() => 'Hoàn thành');
    repo.findByOrderItemAndUser.mock.mockImplementation(() => null);
    const service = new ProductReviewsService(repo);

    const result = await service.checkEligibility('TP001', 1, 5);
    assert.equal(result.eligible, true);
    assert.equal(result.productId, 1);
    assert.equal(result.orderCode, 'TP001');
  });

  it('returns eligible:false with existing review info when already reviewed', async () => {
    const repo = mockRepo();
    repo.verifyOrderItemOwnership.mock.mockImplementation(() => ({ order_id: 10, product_id: 1, order_code: 'TP001' }));
    repo.getLatestOrderStatus.mock.mockImplementation(() => 'Hoàn thành');
    repo.findByOrderItemAndUser.mock.mockImplementation(() => ({ id: 99, user_id: 5, product_id: 1 }));
    repo.getReviewTimeline.mock.mockImplementation(() => ({ revisions: [], replies: [] }));
    const service = new ProductReviewsService(repo);

    const result = await service.checkEligibility('TP001', 1, 5);
    assert.equal(result.eligible, false);
    assert.ok(result.reason.includes('đã đánh giá'));
    assert.ok(result.review);
    assert.equal(result.review.id, 99);
  });

  // ────── createReview ──────

  it('rejects createReview with invalid rating', async () => {
    const repo = mockRepo();
    const service = new ProductReviewsService(repo);

    await assert.rejects(
      () => service.createReview({ userId: 5, productId: 1, orderItemId: 1, rating: 6, comment: 'Tốt' }),
      { code: 'INVALID_RATING' },
    );
  });

  it('rejects createReview when order not owned by user', async () => {
    const repo = mockRepo();
    repo.verifyOrderItemOwnership.mock.mockImplementation(() => null);
    const service = new ProductReviewsService(repo);

    await assert.rejects(
      () => service.createReview({ userId: 5, productId: 1, orderItemId: 1, rating: 5, comment: 'Tốt' }),
      { code: 'FORBIDDEN' },
    );
  });

  it('rejects createReview when order not completed', async () => {
    const repo = mockRepo();
    repo.verifyOrderItemOwnership.mock.mockImplementation(() => ({ order_id: 10, product_id: 1, order_code: 'TP001' }));
    repo.getLatestOrderStatus.mock.mockImplementation(() => 'Đang xử lý');
    const service = new ProductReviewsService(repo);

    await assert.rejects(
      () => service.createReview({ userId: 5, productId: 1, orderItemId: 1, rating: 4, comment: 'Ngon' }),
      { code: 'NOT_COMPLETED' },
    );
  });

  it('creates a review and attaches media when intentIds provided', async () => {
    const repo = mockRepo();
    const storage = new FakeReviewStorage();
    repo.verifyOrderItemOwnership.mock.mockImplementation(() => ({ order_id: 10, product_id: 1, order_code: 'TP001' }));
    repo.getLatestOrderStatus.mock.mockImplementation(() => 'Hoàn thành');
    repo.createReview.mock.mockImplementation(() => ({
      review: { id: 100, user_id: 5, product_id: 1, order_item_id: 1, rating: 5, comment: 'Tuyệt' },
      revision: { id: 200, review_id: 100, sequence: 1, revision_type: 'original', rating: 5, comment: 'Tuyệt' },
    }));
    repo.findUploadIntent.mock.mockImplementation(() => ({
      id: 'intent-1',
      owner_user_id: 5,
      media_type: 'image',
      storage_key: 'review-media/key',
      requested_content_type: 'image/jpeg',
      requested_byte_size: 50000,
      claimed_at: null,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }));
    repo.claimUploadIntent.mock.mockImplementation(() => ({
      id: 'intent-1',
      owner_user_id: 5,
      media_type: 'image',
      storage_key: 'review-media/key',
      requested_content_type: 'image/jpeg',
      requested_byte_size: 50000,
    }));
    repo.attachMedia.mock.mockImplementation(() => ({ id: 300, media_type: 'image' }));

    // Simulate upload to fake storage so verifyObject passes
    await storage.simulateUpload('review-media/key', Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]), 'image/jpeg');

    const service = new ProductReviewsService(repo, storage);

    const result = await service.createReview({
      userId: 5, productId: 1, orderItemId: 1, rating: 5, comment: 'Tuyệt', intentIds: ['intent-1'],
    });

    assert.equal(result.review.id, 100);
    assert.equal(result.revision.id, 200);
    assert.equal(repo.claimUploadIntent.mock.callCount(), 1);
    assert.equal(repo.attachMedia.mock.callCount(), 1);
  });

  // ────── editReview ──────

  it('rejects editReview with invalid rating', async () => {
    const repo = mockRepo();
    const service = new ProductReviewsService(repo);

    await assert.rejects(
      () => service.editReview(100, 5, { rating: 0, comment: 'Sửa' }),
      { code: 'INVALID_RATING' },
    );
  });

  it('delegates editReview to repo and attaches media', async () => {
    const repo = mockRepo();
    const storage = new FakeReviewStorage();
    repo.editReview.mock.mockImplementation(() => ({
      review: { id: 100, user_id: 5, product_id: 1, current_revision_id: 201 },
      revision: { id: 201, review_id: 100, sequence: 2, revision_type: 'customer_edit', rating: 4, comment: 'Sửa' },
    }));
    repo.findUploadIntent.mock.mockImplementation(() => ({
      id: 'intent-2',
      owner_user_id: 5,
      media_type: 'video',
      storage_key: 'review-media/key2',
      requested_content_type: 'video/mp4',
      requested_byte_size: 2000000,
      claimed_at: null,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }));
    repo.claimUploadIntent.mock.mockImplementation(() => ({
      id: 'intent-2',
      owner_user_id: 5,
      media_type: 'video',
      storage_key: 'review-media/key2',
      requested_content_type: 'video/mp4',
      requested_byte_size: 2000000,
    }));
    repo.attachMedia.mock.mockImplementation(() => ({ id: 301, media_type: 'video' }));

    // Simulate upload to fake storage (MP4 magic bytes: ftyp box)
    const mp4Header = Buffer.alloc(12);
    mp4Header[4] = 0x66; mp4Header[5] = 0x74; mp4Header[6] = 0x79; mp4Header[7] = 0x70;
    await storage.simulateUpload('review-media/key2', mp4Header, 'video/mp4');

    const service = new ProductReviewsService(repo, storage);

    const result = await service.editReview(100, 5, { rating: 4, comment: 'Sửa', intentIds: ['intent-2'] });

    assert.equal(result.review.current_revision_id, 201);
    assert.equal(repo.claimUploadIntent.mock.callCount(), 1);
    assert.equal(repo.attachMedia.mock.callCount(), 1);
  });

  // ────── createUploadIntent ──────

  it('creates an upload intent with valid image type', async () => {
    const repo = mockRepo();
    repo.createUploadIntent.mock.mockImplementation((data) => ({
      id: data.id,
      storage_key: data.storageKey,
      expires_at: data.expiresAt,
    }));
    const storage = new FakeReviewStorage();
    const service = new ProductReviewsService(repo, storage);

    const result = await service.createUploadIntent({
      userId: 5, action: 'create_original', mediaType: 'image', contentType: 'image/jpeg', byteSize: 50000,
    });

    assert.ok(result.intentId);
    assert.ok(result.storageKey);
    assert.ok(result.uploadUrl);
    assert.ok(result.uploadUrl.startsWith('fake://'));
    assert.ok(result.expiresAt);
  });

  it('rejects upload intent with disallowed content type', async () => {
    const repo = mockRepo();
    const service = new ProductReviewsService(repo);

    await assert.rejects(
      () => service.createUploadIntent({
        userId: 5, action: 'create_original', mediaType: 'image', contentType: 'image/gif', byteSize: 50000,
      }),
      { code: 'INVALID_CONTENT_TYPE' },
    );
  });

  it('rejects image larger than 1MB', async () => {
    const repo = mockRepo();
    const service = new ProductReviewsService(repo);

    await assert.rejects(
      () => service.createUploadIntent({
        userId: 5, action: 'create_original', mediaType: 'image', contentType: 'image/jpeg', byteSize: 2 * 1024 * 1024,
      }),
      { code: 'FILE_TOO_LARGE' },
    );
  });

  it('rejects video larger than 10MB', async () => {
    const repo = mockRepo();
    const service = new ProductReviewsService(repo);

    await assert.rejects(
      () => service.createUploadIntent({
        userId: 5, action: 'create_original', mediaType: 'video', contentType: 'video/mp4', byteSize: 15 * 1024 * 1024,
      }),
      { code: 'FILE_TOO_LARGE' },
    );
  });

  // ────── getCustomerReview ──────

  it('returns null when no review exists', async () => {
    const repo = mockRepo();
    repo.getCustomerReview.mock.mockImplementation(() => null);
    const service = new ProductReviewsService(repo);

    const result = await service.getCustomerReview(1, 5);
    assert.equal(result, null);
  });

  it('returns enriched review DTO with timeline', async () => {
    const repo = mockRepo();
    repo.getCustomerReview.mock.mockImplementation(() => ({
      id: 100, user_id: 5, product_id: 1, order_item_id: 1,
      visibility_status: 'visible', current_revision_id: 200,
      current_rating: 5, current_comment: 'Tuyệt',
      created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
      purchase_verified_at: '2026-09-01T00:00:00.000Z',
      media: [], reply: null,
    }));
    repo.getReviewTimeline.mock.mockImplementation(() => ({
      revisions: [{ id: 200, sequence: 1, revision_type: 'original', rating: 5, comment: 'Tuyệt' }],
      replies: [],
    }));
    const service = new ProductReviewsService(repo);

    const result = await service.getCustomerReview(1, 5);
    assert.ok(result);
    assert.equal(result.id, 100);
    assert.ok(result.timeline);
    assert.equal(result.timeline.revisions.length, 1);
  });

  // ────── listProductReviews ──────

  it('returns paginated public reviews', async () => {
    const repo = mockRepo();
    repo.listProductReviews.mock.mockImplementation(() => ({
      items: [
        { id: 1, rating: 5, comment: 'Hay', revision_created_at: '2026-09-02T00:00:00.000Z', fullname: 'Nguyễn A', media: [], reply: null },
        { id: 2, rating: 4, comment: 'Tốt', revision_created_at: '2026-09-01T00:00:00.000Z', fullname: 'Trần B', media: [], reply: null },
      ],
      nextCursor: '2026-09-01T00:00:00.000Z',
      hasMore: true,
    }));
    const service = new ProductReviewsService(repo);

    const result = await service.listProductReviews(1, { sort: 'newest', limit: 10 });

    assert.equal(result.items.length, 2);
    assert.ok(result.hasMore);
    assert.ok(result.cursor);
  });

  it('applies rating filter', async () => {
    const repo = mockRepo();
    repo.listProductReviews.mock.mockImplementation(() => ({ items: [], nextCursor: null, hasMore: false }));
    const service = new ProductReviewsService(repo);

    const result = await service.listProductReviews(1, { sort: 'newest', rating: 5, limit: 10 });

    assert.equal(result.items.length, 0);
    assert.equal(repo.listProductReviews.mock.callCount(), 1);
    const args = repo.listProductReviews.mock.calls[0].arguments;
    assert.equal(args[1].rating, 5);
  });

  // ────── getProductReviewSummary ──────

  it('returns review summary for a product', async () => {
    const repo = mockRepo();
    repo.getProductReviewSummary.mock.mockImplementation(() => ({
      total_review_count: 10,
      average_rating: 4.2,
      rating_5: 5, rating_4: 3, rating_3: 1, rating_2: 1, rating_1: 0,
    }));
    const service = new ProductReviewsService(repo);

    const result = await service.getProductReviewSummary(1);

    assert.equal(result.total_review_count, 10);
    assert.equal(result.average_rating, 4.2);
    assert.equal(result.rating_5, 5);
  });

  // ────── listAdminReviews ──────

  it('enforces branch scope for manager role', async () => {
    const repo = mockRepo();
    repo.listAdminReviews.mock.mockImplementation(() => ({ items: [], cursor: null, hasMore: false }));
    const service = new ProductReviewsService(repo);

    await service.listAdminReviews({
      storeId: null, visibility: 'hidden', adminRole: 'manager', adminBranchId: 3,
    });

    const args = repo.listAdminReviews.mock.calls[0].arguments;
    assert.equal(args[0].storeId, 3); // manager's branch_id overrides storeId
  });

  it('passes through storeId for super role', async () => {
    const repo = mockRepo();
    repo.listAdminReviews.mock.mockImplementation(() => ({ items: [], cursor: null, hasMore: false }));
    const service = new ProductReviewsService(repo);

    await service.listAdminReviews({
      storeId: 2, visibility: 'all', adminRole: 'super', adminBranchId: 3,
    });

    const args = repo.listAdminReviews.mock.calls[0].arguments;
    assert.equal(args[0].storeId, 2); // super uses the passed storeId
  });

  // ────── replyToReview ──────

  it('rejects empty reply body', async () => {
    const repo = mockRepo();
    const service = new ProductReviewsService(repo);

    await assert.rejects(
      () => service.replyToReview(100, 1, '   '),
      { code: 'EMPTY_REPLY' },
    );
  });

  it('delegates valid reply to repo', async () => {
    const repo = mockRepo();
    repo.replyToReview.mock.mockImplementation(() => ({ id: 50, review_id: 100, admin_user_id: 1, body: 'Cảm ơn bạn' }));
    const service = new ProductReviewsService(repo);

    const result = await service.replyToReview(100, 1, 'Cảm ơn bạn');

    assert.equal(result.body, 'Cảm ơn bạn');
    assert.equal(repo.replyToReview.mock.callCount(), 1);
  });

  // ────── setReviewVisibility ──────

  it('rejects invalid visibility value', async () => {
    const repo = mockRepo();
    const service = new ProductReviewsService(repo);

    await assert.rejects(
      () => service.setReviewVisibility(100, 1, 'deleted', null),
      { code: 'INVALID_VISIBILITY' },
    );
  });

  it('delegates valid visibility change to repo', async () => {
    const repo = mockRepo();
    repo.setVisibility.mock.mockImplementation(() => ({
      id: 100, visibility_status: 'hidden', hidden_by: 1, hidden_reason: 'Spam',
    }));
    const service = new ProductReviewsService(repo);

    const result = await service.setReviewVisibility(100, 1, 'hidden', 'Spam');

    assert.equal(result.visibility_status, 'hidden');
    assert.equal(repo.setVisibility.mock.callCount(), 1);
  });

  // ────── checkAdminReviewAccess ──────

  it('super role bypasses branch check', async () => {
    const repo = mockRepo();
    const service = new ProductReviewsService(repo);

    const result = await service.checkAdminReviewAccess(100, 'super', null);
    assert.equal(result, true);
  });

  it('manager allowed when branch matches', async () => {
    const repo = mockRepo();
    repo.getReviewStoreId.mock.mockImplementation(() => 3);
    const service = new ProductReviewsService(repo);

    const result = await service.checkAdminReviewAccess(100, 'manager', 3);
    assert.equal(result, true);
  });

  it('manager forbidden when branch mismatches', async () => {
    const repo = mockRepo();
    repo.getReviewStoreId.mock.mockImplementation(() => 3);
    const service = new ProductReviewsService(repo);

    await assert.rejects(
      () => service.checkAdminReviewAccess(100, 'manager', 5),
      { code: 'FORBIDDEN' },
    );
  });

  it('non-super/manager role is forbidden', async () => {
    const repo = mockRepo();
    const service = new ProductReviewsService(repo);

    await assert.rejects(
      () => service.checkAdminReviewAccess(100, 'kitchen', null),
      { code: 'FORBIDDEN' },
    );
  });
});
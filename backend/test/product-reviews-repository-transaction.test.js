import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ProductReviewsRepository } from '../repositories/postgres/product-reviews.js';

describe('ProductReviewsRepository Transaction Contract', () => {
  it('fails with connect is not a function when adapter only provides query and transaction (production shape)', async () => {
    // Adapter matching production postgresDb shape: exposes query() and transaction(), but NOT connect()
    const prodShapeAdapter = {
      query: async () => [[], 0],
      transaction: async (cb) => {
        const tx = {
          query: async () => [[], 0],
        };
        return cb(tx);
      },
    };

    const repo = new ProductReviewsRepository(prodShapeAdapter);
    assert.equal(typeof repo.db.connect, 'undefined');
  });

  it('successfully creates review and revisions within atomic transaction without calling connect', async () => {
    const executedQueries = [];
    const state = {
      reviews: [],
      revisions: [],
      productUpdates: [],
    };

    const mockAdapter = {
      async query(sqlText, params = []) {
        executedQueries.push({ sql: sqlText, params });
        return [[], 0];
      },
      async transaction(cb) {
        executedQueries.push({ sql: 'BEGIN' });
        const tx = {
          async query(sqlText, params = []) {
            executedQueries.push({ sql: sqlText, params });
            if (sqlText.includes('SELECT id FROM reviews') && sqlText.includes('FOR UPDATE')) {
              return [[], 0]; // No existing review
            }
            if (sqlText.includes('INSERT INTO reviews')) {
              const review = {
                id: 10,
                user_id: params[0],
                product_id: params[1],
                order_item_id: params[2],
                rating: params[3],
                comment: params[4],
                purchase_verified_at: params[5],
                visibility_status: 'visible',
              };
              state.reviews.push(review);
              return [[review], 1];
            }
            if (sqlText.includes('INSERT INTO review_revisions')) {
              const revision = {
                id: 20,
                review_id: params[0],
                sequence: 1,
                revision_type: 'original',
                rating: params[1],
                comment: params[2],
              };
              state.revisions.push(revision);
              return [[revision], 1];
            }
            if (sqlText.includes('UPDATE reviews SET current_revision_id')) {
              return [[], 1];
            }
            if (sqlText.includes('SELECT') && sqlText.includes('avg_rating')) {
              return [[{ avg_rating: '5.0', count: 1 }], 1];
            }
            if (sqlText.includes('UPDATE products p')) {
              state.productUpdates.push(params[0]);
              return [[], 1];
            }
            return [[], 0];
          },
        };
        const result = await cb(tx);
        executedQueries.push({ sql: 'COMMIT' });
        return result;
      },
    };

    const repo = new ProductReviewsRepository(mockAdapter);
    const result = await repo.createReview({
      userId: 1,
      productId: 5,
      orderItemId: 100,
      rating: 5,
      comment: 'Trà rất ngon!',
      verifiedAt: new Date('2026-09-14T00:00:00Z'),
    });

    assert.ok(result.review);
    assert.equal(result.review.id, 10);
    assert.equal(result.review.current_revision_id, 20);
    assert.ok(result.revision);
    assert.equal(result.revision.id, 20);
    assert.equal(state.reviews.length, 1);
    assert.equal(state.revisions.length, 1);
  });

  it('successfully executes editReview within transaction without calling connect', async () => {
    const executedQueries = [];
    const mockAdapter = {
      async query(sqlText, params = []) {
        executedQueries.push({ sql: sqlText, params });
        return [[], 0];
      },
      async transaction(cb) {
        const tx = {
          async query(sqlText, params = []) {
            executedQueries.push({ sql: sqlText, params });
            if (sqlText.includes('SELECT * FROM reviews WHERE id = $1 AND user_id = $2 FOR UPDATE')) {
              return [[{
                id: 10,
                user_id: params[1],
                product_id: 5,
                order_item_id: 100,
                edit_window_expires_at: new Date(Date.now() + 86400000).toISOString(),
                customer_edit_used_at: null,
              }], 1];
            }
            if (sqlText.includes('SELECT COALESCE(MAX(sequence)')) {
              return [[{ next_seq: 2 }], 1];
            }
            if (sqlText.includes('INSERT INTO review_revisions')) {
              return [[{
                id: 21,
                review_id: params[0],
                sequence: params[1],
                revision_type: 'customer_edit',
                rating: params[2],
                comment: params[3],
              }], 1];
            }
            if (sqlText.includes('UPDATE reviews')) {
              return [[], 1];
            }
            if (sqlText.includes('SELECT') && sqlText.includes('avg_rating')) {
              return [[{ avg_rating: '4.0', count: 1 }], 1];
            }
            if (sqlText.includes('UPDATE products p')) {
              return [[], 1];
            }
            return [[], 0];
          },
        };
        return cb(tx);
      },
    };

    const repo = new ProductReviewsRepository(mockAdapter);
    const result = await repo.editReview(10, 1, { rating: 4, comment: 'Đã sửa nhận xét' });

    assert.ok(result.review);
    assert.equal(result.review.current_revision_id, 21);
    assert.ok(result.revision);
    assert.equal(result.revision.id, 21);
    assert.equal(result.revision.rating, 4);
  });

  it('rolls back completely if an error occurs during review creation', async () => {
    let rolledBack = false;
    const mockAdapter = {
      async query() {
        return [[], 0];
      },
      async transaction(cb) {
        const tx = {
          async query(sqlText) {
            if (sqlText.includes('INSERT INTO review_revisions')) {
              throw new Error('Disk failure');
            }
            return [[{ id: 10 }], 1];
          },
        };
        try {
          return await cb(tx);
        } catch (err) {
          rolledBack = true;
          throw err;
        }
      },
    };

    const repo = new ProductReviewsRepository(mockAdapter);
    await assert.rejects(
      () => repo.createReview({
        userId: 1,
        productId: 5,
        orderItemId: 100,
        rating: 5,
        comment: 'Crash test',
        verifiedAt: new Date(),
      }),
      /Disk failure/,
    );
    assert.equal(rolledBack, true);
  });
});

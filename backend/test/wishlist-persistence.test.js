import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCustomerId,
  validateWishlistProductId,
  CustomerValidationError,
} from '../validation/customer-schemas.js';
import {
  validateProductAvailabilityInput,
  CatalogValidationError,
} from '../validation/catalog-schemas.js';
import { toWishlistDto } from '../dto/engagement-dto.js';
import { createEngagementRepository } from '../repositories/postgres/engagement.js';
import { createAdminCatalogRepository, AdminCatalogError } from '../repositories/postgres/admin-catalog.js';

test('Wishlist Persistence & Availability Suite', async (t) => {
  await t.test('validation schemas strictly enforce positive integers and boolean availability', () => {
    // Valid
    assert.equal(validateCustomerId(5), 5);
    assert.equal(validateCustomerId('10'), 10);
    assert.equal(validateWishlistProductId(3), 3);
    assert.equal(validateProductAvailabilityInput({ is_available: true }), true);
    assert.equal(validateProductAvailabilityInput({ is_available: false }), false);

    // Invalid customer / product IDs
    assert.throws(() => validateCustomerId('abc'), (err) => err instanceof CustomerValidationError && err.status === 400);
    assert.throws(() => validateCustomerId(-1), (err) => err instanceof CustomerValidationError && err.status === 400);
    assert.throws(() => validateWishlistProductId(0), (err) => err instanceof CustomerValidationError && err.status === 400);

    // Invalid availability input
    assert.throws(() => validateProductAvailabilityInput({}), (err) => err instanceof CatalogValidationError && err.status === 400);
    assert.throws(() => validateProductAvailabilityInput({ is_available: 'yes' }), (err) => err instanceof CatalogValidationError && err.status === 400);
  });

  await t.test('toWishlistDto maps persisted product metadata without fabricated values', () => {
    const dto = toWishlistDto({
      id: 1,
      user_id: 10,
      product_id: 5,
      product_name: 'Trà Xoài Nhiệt Đới',
      product_slug: 'tra-xoai-nhiet-doi',
      base_tea: 'Trà Nhài',
      price: 35000,
      image_url: 'https://images.unsplash.com/photo-test',
      created_at: '2026-08-24T12:00:00Z',
    });

    assert.equal(dto.id, 1);
    assert.equal(dto.user_id, 10);
    assert.equal(dto.product_id, 5);
    assert.equal(dto.product_name, 'Trà Xoài Nhiệt Đới');
    assert.equal(dto.product_slug, 'tra-xoai-nhiet-doi');
    assert.equal(dto.base_tea, 'Trà Nhài');
    assert.equal(dto.price, 35000);
    assert.equal(dto.image_url, 'https://images.unsplash.com/photo-test');
  });

  await t.test('ensureUserWishlistItem rejects unavailable products with 409 and missing products with 404', async () => {
    const fakeDb = {
      async transaction(callback) {
        return callback({
          async query(sql, params) {
            if (sql.includes('SELECT') && sql.includes('FOR SHARE')) {
              const productId = params[0];
              if (productId === 999) return [[], 0]; // Missing
              if (productId === 888) {
                return [[{ id: 888, name: 'Món Tắt', slug: 'mon-tat', base_tea: 'Trà Đen', price: 30000, is_available: false }], 1];
              }
              return [[{ id: 1, name: 'Trà Đào', slug: 'tra-dao', base_tea: 'Trà Oolong', price: 32000, is_available: true }], 1];
            }
            if (sql.includes('INSERT INTO wishlists')) {
              return [[{ id: 42, user_id: params[0], product_id: params[1], created_at: new Date().toISOString() }], 1];
            }
            if (sql.includes('SELECT id, user_id')) {
              return [[], 0]; // Not yet existing
            }
            return [[], 0];
          },
        });
      },
    };

    const repo = createEngagementRepository(fakeDb);

    // Missing -> 404
    await assert.rejects(
      () => repo.ensureUserWishlistItem(10, 999),
      (err) => err.status === 404 && err.message.includes('Không tìm thấy sản phẩm'),
    );

    // Unavailable -> 409
    await assert.rejects(
      () => repo.ensureUserWishlistItem(10, 888),
      (err) => err.status === 409 && err.message.includes('tạm ngưng phục vụ'),
    );

    // Available -> created
    const result = await repo.ensureUserWishlistItem(10, 1);
    assert.equal(result.created, true);
    assert.equal(result.item.product_name, 'Trà Đào');
    assert.equal(result.item.base_tea, 'Trà Oolong');
  });

  await t.test('ensureUserWishlistItem uses ON CONFLICT and returns the persisted row on repeat', async () => {
    const queries = [];
    const fakeDb = {
      async transaction(callback) {
        return callback({
          async query(sql, params) {
            queries.push(sql);
            if (sql.includes('FOR SHARE')) {
              return [[{
                id: 1,
                name: 'Trà Đào',
                slug: 'tra-dao',
                base_tea: 'Trà đen',
                price: 45000,
                image_url: null,
                is_available: true,
              }], 1];
            }
            if (sql.includes('INSERT INTO wishlists')) return [[], 0];
            if (sql.includes('SELECT id, user_id, product_id, created_at FROM wishlists')) {
              return [[{ id: 9, user_id: params[0], product_id: params[1], created_at: '2026-08-24T00:00:00.000Z' }], 1];
            }
            return [[], 0];
          },
        });
      },
    };

    const repo = createEngagementRepository(fakeDb);
    const result = await repo.ensureUserWishlistItem(10, 1);

    assert.equal(result.created, false);
    assert.equal(result.item.id, 9);
    assert.ok(queries.some((sql) => sql.includes('ON CONFLICT (user_id, product_id) DO NOTHING')));
  });

  await t.test('setProductAvailability executes fan-out notification and deletion when turning product inactive', async () => {
    const executedQueries = [];
    const fakeDb = {
      async transaction(callback) {
        return callback({
          async query(sql, params) {
            executedQueries.push({ sql, params });
            if (sql.includes('SELECT') && sql.includes('FOR UPDATE')) {
              return [[{ id: 1, name: 'Trà Đào Cam Sả', is_available: true }], 1];
            }
            if (sql.includes('INSERT INTO notifications')) {
              return [[], 3]; // 3 notifications affected
            }
            if (sql.includes('DELETE FROM wishlists')) {
              return [[], 3]; // 3 wishlists deleted
            }
            if (sql.includes('UPDATE products')) {
              return [[], 1];
            }
            return [[], 0];
          },
        });
      },
    };

    const repo = createAdminCatalogRepository(fakeDb);
    const res = await repo.setProductAvailability(1, false);

    assert.equal(res.changed, true);
    assert.equal(res.is_available, false);
    assert.equal(res.removed_wishlist_count, 3);
    assert.equal(res.notification_count, 3);

    // Verify atomic query sequence
    const hasNotifInsert = executedQueries.some((q) => q.sql.includes('INSERT INTO notifications') && q.sql.includes('Món yêu thích tạm ngưng phục vụ'));
    const hasWishlistDelete = executedQueries.some((q) => q.sql.includes('DELETE FROM wishlists WHERE product_id = $1'));
    const hasProductUpdate = executedQueries.some((q) => q.sql.includes('UPDATE products SET is_available = FALSE'));

    assert.ok(hasNotifInsert, 'must notify affected customers');
    assert.ok(hasWishlistDelete, 'must delete wishlist rows for deactivated product');
    assert.ok(hasProductUpdate, 'must update product is_available to false');
  });

  await t.test('setProductAvailability is idempotent when target state matches current state', async () => {
    const fakeDb = {
      async transaction(callback) {
        return callback({
          async query(sql) {
            if (sql.includes('SELECT') && sql.includes('FOR UPDATE')) {
              return [[{ id: 1, name: 'Trà Đào Cam Sả', is_available: true }], 1];
            }
            throw new Error('Should not execute updates or deletes when state is already identical');
          },
        });
      },
    };

    const repo = createAdminCatalogRepository(fakeDb);
    const res = await repo.setProductAvailability(1, true);

    assert.equal(res.changed, false);
    assert.equal(res.is_available, true);
    assert.equal(res.removed_wishlist_count, 0);
    assert.equal(res.notification_count, 0);
  });

  await t.test('setProductAvailability rejects non-boolean repository input', async () => {
    const repo = createAdminCatalogRepository({
      async transaction() {
        throw new Error('transaction must not run for invalid input');
      },
    });

    await assert.rejects(
      () => repo.setProductAvailability(1, 'false'),
      (err) => err instanceof AdminCatalogError && err.status === 400,
    );
  });
});

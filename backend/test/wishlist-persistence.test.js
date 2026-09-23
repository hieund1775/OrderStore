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
import { createEngagementService } from '../services/engagement/engagement-service.js';

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

  await t.test('validateStoreId rejects invalid store_id with 400 in engagementService', async () => {
    const service = createEngagementService({});

    await assert.rejects(
      () => service.listUserWishlist(10, 'abc'),
      (err) => err.status === 400 && err.message.includes('Mã chi nhánh không hợp lệ'),
    );
    await assert.rejects(
      () => service.listUserWishlist(10, -1),
      (err) => err.status === 400 && err.message.includes('Mã chi nhánh không hợp lệ'),
    );
    await assert.rejects(
      () => service.listUserWishlist(10, 0),
      (err) => err.status === 400 && err.message.includes('Mã chi nhánh không hợp lệ'),
    );
    await assert.rejects(
      () => service.ensureUserWishlistItem(10, 1, 'invalid'),
      (err) => err.status === 400 && err.message.includes('Mã chi nhánh không hợp lệ'),
    );
  });

  await t.test('listUserWishlist and ensureUserWishlistItem use branch offer state and lock only products', async () => {
    const executedQueries = [];
    const fakeDb = {
      async query(sql, params) {
        executedQueries.push({ sql, params });
        return [[], 0];
      },
      async transaction(callback) {
        return callback({
          async query(sql, params) {
            executedQueries.push({ sql, params });
            if (sql.includes('SELECT') && sql.includes('FOR SHARE OF p')) {
              return [[{
                id: 1,
                name: 'Cà Phê Sữa',
                slug: 'ca-phe-sua',
                base_tea: 'Cà phê truyền thống',
                product_is_available: true,
                is_available: false, // Not available at branch
                price: null,
                sku: 'SKU-43-M',
                variant_id: 101,
                variant_name: 'Size M',
                fulfillment_lane: 'kitchen',
                stock_mode: 'made_to_order',
                has_options: true,
              }], 1];
            }
            if (sql.includes('INSERT INTO wishlists')) {
              return [[{ id: 99, user_id: params[0], product_id: params[1], created_at: new Date().toISOString() }], 1];
            }
            return [[], 0];
          },
        });
      },
    };

    const repo = createEngagementRepository(fakeDb);

    // 1. listUserWishlist with storeId
    await repo.listUserWishlist(10, 2);
    const listQuery = executedQueries.find((q) => q.sql.includes('FROM wishlists w'));
    assert.ok(listQuery, 'list query must be executed');
    assert.ok(listQuery.sql.includes('LEFT JOIN LATERAL'), 'must use LATERAL join for Catalog V2 variants');
    assert.ok(listQuery.sql.includes("CASE WHEN pv.variant_signature = 'default' THEN 0 ELSE 1 END"), 'must prioritize default variant but support any active variant');
    assert.ok(listQuery.sql.includes('LEFT JOIN branch_variant_offers bvo'), 'must join offers from the selected branch');
    assert.ok(listQuery.sql.includes('COALESCE(bvo.is_available, FALSE) = TRUE'), 'must require an enabled branch offer');
    assert.ok(listQuery.sql.includes('bvo.price > 0'), 'must require a positive branch price');
    assert.ok(listQuery.sql.includes('bvo.price ASC NULLS LAST'), 'must prioritize the cheapest branch offer');
    assert.equal(listQuery.sql.includes('branch_variant_inventory'), false, 'wishlist availability must not depend on inventory');
    assert.equal(listQuery.sql.includes('on_hand'), false, 'wishlist availability must not inspect on-hand stock');
    assert.equal(listQuery.sql.includes('reserved'), false, 'wishlist availability must not inspect reserved stock');

    // 2. ensureUserWishlistItem with storeId
    const ensureResult = await repo.ensureUserWishlistItem(10, 1, 2);
    const ensureQuery = executedQueries.find((q) => q.sql.includes('FOR SHARE OF p'));
    assert.ok(ensureQuery, 'ensure query must lock only table p');
    assert.ok(!ensureQuery.sql.includes('FOR SHARE\n') && !ensureQuery.sql.endsWith('FOR SHARE'), 'must not lock nullable sides of outer join');

    // 3. Wishlist membership is global: succeeding even if branch offer is not available
    assert.equal(ensureResult.created, true);
    assert.equal(ensureResult.item.product_name, 'Cà Phê Sữa');
    assert.equal(ensureResult.item.is_available, false, 'branch availability is accurately reflected as false without rejecting wishlist add');
  });

  await t.test('multi-variant fixture selects the cheapest enabled offer and reports unavailable when all offers are disabled', async () => {
    // Fixture tables:
    // Product 1: "Cà Phê Sữa", active, stock_mode: 'tracked'
    // Variant 101 (default) has a disabled offer at store 2.
    // Variant 102 (size L) has an enabled offer at store 2.
    const fixtureData = {
      products: [
        { id: 1, name: 'Cà Phê Sữa', slug: 'ca-phe-sua', base_tea: 'Cà phê', is_available: true, status: 'active', fulfillment_lane: 'kitchen', stock_mode: 'made_to_order', product_type_schema_id: 1 },
      ],
      wishlists: [
        { id: 10, user_id: 5, product_id: 1, created_at: '2026-09-23T10:00:00Z' },
      ],
      product_variants: [
        { id: 101, product_id: 1, sku: 'CFS-DEFAULT-M', name_suffix: 'Size M', variant_signature: 'default', status: 'active' },
        { id: 102, product_id: 1, sku: 'CFS-UPGRADE-L', name_suffix: 'Size L', variant_signature: 'size_l', status: 'active' },
      ],
      branch_variant_offers: [
        // Store 2: default offer disabled, second variant enabled
        { store_id: 2, variant_id: 101, price: 30000, is_available: false },
        { store_id: 2, variant_id: 102, price: 38000, is_available: true },
        // Store 3: 101 offer is disabled, 102 offer is active
        { store_id: 3, variant_id: 101, price: 30000, is_available: false },
        { store_id: 3, variant_id: 102, price: 38000, is_available: true },
        // Store 4: all offers disabled
        { store_id: 4, variant_id: 101, price: 30000, is_available: false },
        { store_id: 4, variant_id: 102, price: 38000, is_available: false },
        // Store 5: both offers active, 101 is 50000, 102 is 38000 -> must pick lowest price (102)
        { store_id: 5, variant_id: 101, price: 50000, is_available: true },
        { store_id: 5, variant_id: 102, price: 38000, is_available: true },
      ],
    };

    function resolveFixtureLateral(productId, storeId) {
      const prod = fixtureData.products.find((p) => p.id === productId);
      if (!prod || prod.status !== 'active') return null;

      const variants = fixtureData.product_variants.filter((v) => v.product_id === productId && v.status === 'active');
      const evaluated = variants.map((v) => {
        const offer = fixtureData.branch_variant_offers.find((o) => o.variant_id === v.id && o.store_id === storeId);
        const isSellable = Boolean(
          offer &&
          offer.is_available === true &&
          typeof offer.price === 'number' &&
          offer.price > 0
        );
        return {
          id: v.id,
          sku: v.sku,
          name_suffix: v.name_suffix,
          variant_signature: v.variant_signature,
          branch_price: offer?.price ?? null,
          is_sellable: isSellable,
        };
      });

      evaluated.sort((a, b) => {
        if (a.is_sellable !== b.is_sellable) return a.is_sellable ? -1 : 1;
        if (a.branch_price !== b.branch_price) {
          if (a.branch_price == null) return 1;
          if (b.branch_price == null) return -1;
          return a.branch_price - b.branch_price;
        }
        if ((a.variant_signature === 'default') !== (b.variant_signature === 'default')) {
          return a.variant_signature === 'default' ? -1 : 1;
        }
        return a.id - b.id;
      });

      return { product: prod, chosenVariant: evaluated[0] };
    }

    const fixtureDb = {
      async query(sql, params) {
        if (sql.includes('FROM wishlists w')) {
          const userId = params[0];
          const storeId = params[1];
          const userWishlists = fixtureData.wishlists.filter((w) => w.user_id === userId);
          const rows = [];
          for (const w of userWishlists) {
            const res = resolveFixtureLateral(w.product_id, storeId);
            if (!res) continue;
            const { product, chosenVariant } = res;
            rows.push({
              id: w.id,
              user_id: w.user_id,
              product_id: w.product_id,
              product_name: product.name,
              product_slug: product.slug,
              base_tea: product.base_tea,
              image_url: null,
              fulfillment_lane: product.fulfillment_lane,
              stock_mode: product.stock_mode,
              variant_id: chosenVariant?.id ?? null,
              sku: chosenVariant?.sku ?? null,
              variant_name: chosenVariant?.name_suffix ?? null,
              has_options: true,
              price: chosenVariant?.branch_price ?? null,
              is_available: Boolean(product.is_available && chosenVariant?.is_sellable),
              created_at: w.created_at,
            });
          }
          return [rows, rows.length];
        }
        return [[], 0];
      },
      async transaction(callback) {
        return callback({
          async query(sql, params) {
            if (sql.includes('FOR SHARE OF p')) {
              const productId = params[0];
              const storeId = params[1];
              const res = resolveFixtureLateral(productId, storeId);
              if (!res) return [[], 0];
              const { product, chosenVariant } = res;
              return [[{
                id: product.id,
                name: product.name,
                slug: product.slug,
                base_tea: product.base_tea,
                image_url: null,
                product_is_available: product.is_available,
                fulfillment_lane: product.fulfillment_lane,
                stock_mode: product.stock_mode,
                variant_id: chosenVariant?.id ?? null,
                sku: chosenVariant?.sku ?? null,
                variant_name: chosenVariant?.name_suffix ?? null,
                has_options: true,
                price: chosenVariant?.branch_price ?? null,
                is_available: Boolean(product.is_available && chosenVariant?.is_sellable),
              }], 1];
            }
            if (sql.includes('INSERT INTO wishlists')) {
              return [[{ id: 11, user_id: params[0], product_id: params[1], created_at: new Date().toISOString() }], 1];
            }
            return [[], 0];
          },
        });
      },
    };

    const repo = createEngagementRepository(fixtureDb);

    // Case 1: Store 2 - default offer is disabled, Variant 102 is sellable
    const itemsStore2 = await repo.listUserWishlist(5, 2);
    assert.equal(itemsStore2.length, 1);
    assert.equal(itemsStore2[0].variant_id, 102);
    assert.equal(itemsStore2[0].sku, 'CFS-UPGRADE-L');
    assert.equal(itemsStore2[0].price, 38000);
    assert.equal(itemsStore2[0].is_available, true, 'must pick variant 102 and be available');
    const dto2 = toWishlistDto(itemsStore2[0]);
    assert.equal(dto2.is_available, true);
    assert.equal(dto2.price, 38000);

    // Case 2: Store 3 - Variant 101 offer is disabled, Variant 102 offer is active
    const itemsStore3 = await repo.listUserWishlist(5, 3);
    assert.equal(itemsStore3[0].variant_id, 102);
    assert.equal(itemsStore3[0].sku, 'CFS-UPGRADE-L');
    assert.equal(itemsStore3[0].price, 38000);
    assert.equal(itemsStore3[0].is_available, true, 'must pick variant 102 and be available');

    // Case 3: Store 4 - all offers are disabled
    const itemsStore4 = await repo.listUserWishlist(5, 4);
    assert.equal(itemsStore4[0].variant_id, 101, 'falls back to default variant');
    assert.equal(itemsStore4[0].is_available, false, 'marked unavailable');
    const dto4 = toWishlistDto(itemsStore4[0]);
    assert.equal(dto4.is_available, false);

    // Case 4: Store 5 - both offers active (101 is 50.000, 102 is 38.000), must select cheapest (102)
    const itemsStore5 = await repo.listUserWishlist(5, 5);
    assert.equal(itemsStore5[0].variant_id, 102, 'picks lowest price variant');
    assert.equal(itemsStore5[0].sku, 'CFS-UPGRADE-L');
    assert.equal(itemsStore5[0].price, 38000);
    assert.equal(itemsStore5[0].is_available, true);
    const dto5 = toWishlistDto(itemsStore5[0]);
    assert.equal(dto5.is_available, true);
    assert.equal(dto5.price, 38000);
  });

  await t.test('toWishlistDto does not invent kitchen or made_to_order fallbacks when data is null', () => {
    const dto = toWishlistDto({
      id: 1,
      user_id: 10,
      product_id: 5,
      product_name: 'Món Mới',
      product_slug: 'mon-moi',
      base_tea: 'Trà Oolong',
      price: null,
      fulfillment_lane: null,
      stock_mode: null,
      created_at: '2026-08-24T12:00:00Z',
    });

    assert.equal(dto.fulfillment_lane, null);
    assert.equal(dto.stock_mode, null);
    assert.equal(dto.price, undefined);
    assert.equal(dto.is_available, false);
  });
});

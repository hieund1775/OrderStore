import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminCatalogV2Repository } from '../repositories/postgres/admin-catalog-v2.js';
import { createCatalogV2Repository } from '../repositories/postgres/catalog-v2.js';
import { createAdminCatalogV2Service } from '../services/catalog/admin-catalog-v2-service.js';
import { createPublicCatalogV2Service } from '../services/catalog/public-catalog-v2-service.js';
import { createFulfillmentService } from '../services/orders/fulfillment-service.js';
import { validateCategoryInput } from '../validation/catalog-v2-schemas.js';
import catalogV2Router from '../routes/admin/catalog-v2.js';
import defaultFulfillmentService from '../services/orders/fulfillment-service.js';
import adminOrderService from '../services/orders/admin-order-service.js';
import postgresDb from '../config/db-postgres.js';
import { updateOrderStatus } from '../routes/admin/orders.js';
import { evaluateOrderTransition } from '../services/order-transition-policy.js';

test('Catalog Lane Operations Regression Suite', async (t) => {
  // -------------------------------------------------------------
  // 1. CATEGORY FULFILLMENT LANE VALIDATION & INHERITANCE
  // -------------------------------------------------------------
  await t.test('category validation accepts valid lanes and rejects invalid lanes', () => {
    // Valid lanes
    const validKitchen = validateCategoryInput({ name: 'Trà sữa', slug: 'tra-sua', default_fulfillment_lane: 'kitchen' });
    assert.equal(validKitchen.default_fulfillment_lane, 'kitchen');

    const validPacking = validateCategoryInput({ name: 'Snack khô', slug: 'snack-kho', default_fulfillment_lane: 'packing' });
    assert.equal(validPacking.default_fulfillment_lane, 'packing');

    const validNull = validateCategoryInput({ name: 'Ngành tổng', slug: 'nganh-tong', default_fulfillment_lane: null });
    assert.equal(validNull.default_fulfillment_lane, null);

    // Invalid lanes
    assert.throws(
      () => validateCategoryInput({ name: 'Lỗi', slug: 'loi', default_fulfillment_lane: 'drone' }),
      /default_fulfillment_lane must be/,
    );
  });

  await t.test('child category creation inherits root product_type_id and persists explicit lane', async () => {
    let capturedCategory = null;
    const mockSchemaRepo = {
      async getCategoryById(id) {
        if (id === 1) return { id: 1, name: 'Ngành F&B', product_type_id: 10, depth: 0, parent_id: null };
        return null;
      },
      async createCategory(payload) {
        capturedCategory = payload;
        return { id: 2, ...payload };
      },
    };

    const service = createAdminCatalogV2Service({ schemaRepository: mockSchemaRepo });
    const created = await service.createCategory({
      name: 'Trà hoa quả',
      slug: 'tra-hoa-qua',
      parent_id: 1,
      default_fulfillment_lane: 'kitchen',
    });

    assert.equal(created.id, 2);
    assert.equal(capturedCategory.default_fulfillment_lane, 'kitchen', 'Must persist default_fulfillment_lane');
  });

  // -------------------------------------------------------------
  // 2. ATOMIC CREATE INDUSTRY TRANSACTION
  // -------------------------------------------------------------
  await t.test('atomic createIndustry commits in one transaction and rolls back on failure', async () => {
    let transactionCommitted = false;
    let transactionRolledBack = false;

    const mockDbSuccess = {
      async transaction(fn) {
        const tx = {
          async query(sql, params) {
            if (sql.includes('product_types')) return [[{ id: 1, name: params[1], code: params[0] }]];
            if (sql.includes('product_type_schemas')) return [[{ id: 10, version: 1, status: 'draft' }]];
            if (sql.includes('categories')) return [[{ id: 100, name: params[0], slug: params[1] }]];
            return [[]];
          },
        };
        const res = await fn(tx);
        transactionCommitted = true;
        return res;
      },
    };

    const repoSuccess = createCatalogV2Repository(mockDbSuccess);
    const result = await repoSuccess.createIndustry({
      name: 'Thời Trang',
      code: 'fashion',
    });

    assert.equal(result.productType.name, 'Thời Trang');
    assert.equal(result.rootCategory.name, 'Thời Trang');
    assert.equal(transactionCommitted, true);

    // Test rollback on failure
    const mockDbFail = {
      async transaction(fn) {
        const tx = {
          async query(sql) {
            if (sql.includes('product_types')) return [[{ id: 1, name: 'Lỗi', code: 'err' }]];
            if (sql.includes('product_type_schemas')) return [[{ id: 10, version: 1, status: 'draft' }]];
            if (sql.includes('categories')) throw new Error('DB Unique constraint violation');
            return [[]];
          },
        };
        try {
          return await fn(tx);
        } catch (err) {
          transactionRolledBack = true;
          throw err;
        }
      },
    };

    const repoFail = createCatalogV2Repository(mockDbFail);
    await assert.rejects(
      () => repoFail.createIndustry({ name: 'Lỗi', code: 'err' }),
      /DB Unique constraint violation/,
    );
    assert.equal(transactionRolledBack, true);
  });

  // -------------------------------------------------------------
  // 3. PRODUCT LANE VALIDATION MATCHING LEAF CATEGORY
  // -------------------------------------------------------------
  await t.test('product create validates lane matches leaf category', async () => {
    const mockDb = {
      async transaction(fn) {
        const tx = {
          async query(sql, params) {
            if (sql.includes('FROM categories WHERE id =')) {
              const catId = params[0];
              if (catId === 10) return [[{ id: 10, default_fulfillment_lane: 'kitchen', archived_at: null }]];
              if (catId === 20) return [[{ id: 20, default_fulfillment_lane: 'packing', archived_at: null }]];
              return [[]];
            }
            if (sql.includes('SELECT 1 FROM categories WHERE parent_id =')) {
              return [[]]; // leaf category
            }
            if (sql.includes('INSERT INTO products')) {
              return [[{ id: 101, name: params[1], fulfillment_lane: params[9] }]];
            }
            if (sql.includes('INSERT INTO product_variants')) {
              return [[{ id: 1, sku: 'SKU-DEF' }]];
            }
            return [[]];
          },
        };
        return fn(tx);
      },
    };

    const repo = createAdminCatalogV2Repository(mockDb);

    // 3a. Rejects kitchen product in packing category
    await assert.rejects(
      () => repo.createProduct({
        name: 'Trà Sữa Lạc Chỗ',
        slug: 'tra-sua-lac-cho',
        category_id: 20,
        fulfillment_lane: 'kitchen',
        price: 30000,
      }),
      (err) => err?.status === 400 && err.message.includes('Khu vực sản phẩm phải trùng với khu vực của danh mục con'),
    );

    // 3b. Rejects packing product in kitchen category
    await assert.rejects(
      () => repo.createProduct({
        name: 'Áo Thun Trong Bếp',
        slug: 'ao-thun-trong-bep',
        category_id: 10,
        fulfillment_lane: 'packing',
        price: 90000,
      }),
      (err) => err?.status === 400 && err.message.includes('Khu vực sản phẩm phải trùng với khu vực của danh mục con'),
    );

    // 3c. Accepts product when lane matches category
    const created = await repo.createProduct({
      name: 'Trà Đào Cam Sả',
      slug: 'tra-dao-cam-sa',
      category_id: 10,
      fulfillment_lane: 'kitchen',
      price: 35000,
    });
    assert.equal(created.name, 'Trà Đào Cam Sả');
    assert.equal(created.fulfillment_lane, 'kitchen');
  });

  // -------------------------------------------------------------
  // 4. LIST PRODUCTS LANE FILTER & LEGACY NULL RESOLUTION
  // -------------------------------------------------------------
  await t.test('listProducts filters correctly and resolves legacy null lane from category', async () => {
    const productsInDb = [
      { id: 1, name: 'Trà Đào', fulfillment_lane: 'kitchen', category_lane: 'kitchen' },
      { id: 2, name: 'Áo Thun', fulfillment_lane: 'packing', category_lane: 'packing' },
      { id: 3, name: 'Món Cũ Kitchen (null)', fulfillment_lane: null, category_lane: 'kitchen' },
      { id: 4, name: 'Món Cũ Packing (null)', fulfillment_lane: null, category_lane: 'packing' },
      { id: 5, name: 'Món Cũ Không Gán (null/null)', fulfillment_lane: null, category_lane: null },
    ];

    const mockRepo = {
      async listProducts(filters) {
        return productsInDb.filter((p) => {
          const effectiveLane = p.fulfillment_lane || p.category_lane || 'kitchen';
          if (filters.lane && effectiveLane !== filters.lane) return false;
          return true;
        });
      },
    };

    const service = createAdminCatalogV2Service({ catalogRepository: mockRepo });

    const kitchenProducts = await service.listProducts({ lane: 'kitchen' });
    assert.equal(kitchenProducts.length, 3); // id 1, 3, 5
    assert.ok(kitchenProducts.some((p) => p.id === 1));
    assert.ok(kitchenProducts.some((p) => p.id === 3));
    assert.ok(kitchenProducts.some((p) => p.id === 5));

    const packingProducts = await service.listProducts({ lane: 'packing' });
    assert.equal(packingProducts.length, 2); // id 2, 4
    assert.ok(packingProducts.some((p) => p.id === 2));
    assert.ok(packingProducts.some((p) => p.id === 4));
  });

  // -------------------------------------------------------------
  // 5. BLOCK 3 PRESET ROUTES RETIRED (410 GONE)
  // -------------------------------------------------------------
  await t.test('preset routes return 410 BLOCK_3_RETIRED', async () => {
    const routes = catalogV2Router.stack.filter((layer) => layer.route && layer.route.path.startsWith('/presets'));
    assert.ok(routes.length >= 3, 'Must have GET, PUT, and DELETE /presets routes');

    for (const routeLayer of routes) {
      const methods = Object.keys(routeLayer.route.methods);
      assert.ok(methods.length > 0);

      // Verify each handler returns 410
      let capturedStatus = null;
      let capturedJson = null;
      const res = {
        status(code) {
          capturedStatus = code;
          return this;
        },
        json(data) {
          capturedJson = data;
          return this;
        },
      };

      // Call the route's last handler directly
      const handlers = routeLayer.route.stack;
      const lastHandler = handlers[handlers.length - 1].handle;
      await lastHandler({ query: {}, body: {}, params: {} }, res, () => {});

      assert.equal(capturedStatus, 410, `Method ${methods[0]} must return 410`);
      assert.equal(capturedJson.error, 'BLOCK_3_RETIRED');
    }
  });

  // -------------------------------------------------------------
  // 6. PUBLIC CATALOG RESOLUTION IGNORES HISTORICAL PRESETS
  // -------------------------------------------------------------
  await t.test('public catalog option resolution ignores historical presets and locks', async () => {
    const mockCatalogRepo = {
      async getProductBySlug(slug) {
        return {
          id: 50,
          name: 'Trà Sữa Trân Châu',
          slug,
          fulfillment_lane: 'kitchen',
          attributes: [
            {
              id: 10,
              code: 'sugar',
              name: 'Mức Đường',
              role: 'modifier',
              is_required: true,
              is_active: true,
              values: [
                { id: 101, code: '100', label: '100% đường', price_adjustment: 0, is_active: true },
                { id: 102, code: '50', label: '50% đường', price_adjustment: 0, is_active: true },
              ],
            },
          ],
          variants: [{ id: 1, sku: 'TS-DEF', variant_signature: 'default', price: 25000, is_available: true }],
        };
      },
    };

    const mockScopesRepo = {
      async getOptionScopesForProduct() {
        return {
          categoryAssignments: [{
            attribute_definition_id: 10,
            is_enabled: true,
            is_required: true,
          }],
          productOverrides: [],
          // Historical presets that must be ignored
          categoryPresets: [{
            attribute_definition_id: 10,
            attribute_value_ids: [102],
            is_locked: true,
          }],
          productPresets: [],
        };
      },
    };

    const service = createPublicCatalogV2Service({
      catalogRepository: mockCatalogRepo,
      optionScopesRepository: mockScopesRepo,
    });

    const config = await service.resolveConfiguration({
      storeId: 1,
      productSlug: 'tra-sua-tran-chau',
      selectedModifierValueIds: [101], // Customer chooses 100% sugar even though preset said 50% & locked
    });

    // Successfully selects 100% sugar without being blocked by retired preset lock
    assert.equal(config.unit_price, 25000);
    assert.equal(config.applied_modifiers.length, 1);
    assert.equal(config.applied_modifiers[0].attribute_value_id, 101);
  });

  // -------------------------------------------------------------
  // 7. MIXED-LANE ORDER HANDOVER BEHAVIOR
  // -------------------------------------------------------------
  await t.test('prepareHandoverToShipper blocks mixed-lane order until all active tasks ready', async () => {
    let tasksInOrder = [];
    const mockRepo = {
      async lockTasksForOrder(orderId) {
        return tasksInOrder;
      },
      async completeReadyTasksForOrder(orderId) {
        const completed = tasksInOrder.filter((t) => t.status === 'ready');
        completed.forEach((t) => { t.status = 'completed'; });
        return completed;
      },
    };

    const mockDb = {
      async transaction(callback) {
        return callback({});
      },
    };

    const fulfillmentService = createFulfillmentService({
      repository: mockRepo,
      database: mockDb,
    });

    const superUser = { sub: 1, role: 'super' };

    // 7a. Single lane order (ready) -> succeeds
    tasksInOrder = [
      { id: 1, order_id: 100, branch_id: 1, lane: 'kitchen', status: 'ready' },
    ];
    const singleResult = await fulfillmentService.prepareHandoverToShipper({
      orderId: 100,
      user: superUser,
    });
    assert.equal(singleResult.branchId, 1);
    assert.equal(singleResult.tasks.length, 1);

    // 7b. Mixed lane order: Packing is ready, Kitchen still preparing -> 409
    tasksInOrder = [
      { id: 1, order_id: 200, branch_id: 1, lane: 'kitchen', status: 'preparing' },
      { id: 2, order_id: 200, branch_id: 1, lane: 'packing', status: 'ready' },
    ];
    await assert.rejects(
      () => fulfillmentService.prepareHandoverToShipper({ orderId: 200, user: superUser }),
      (err) => err?.status === 409 && err?.code === 'FULFILLMENT_OTHER_LANE_NOT_READY',
    );

    // 7c. Mixed lane order: Both tasks ready -> succeeds
    tasksInOrder = [
      { id: 1, order_id: 200, branch_id: 1, lane: 'kitchen', status: 'ready' },
      { id: 2, order_id: 200, branch_id: 1, lane: 'packing', status: 'ready' },
    ];
    const mixedResult = await fulfillmentService.prepareHandoverToShipper({
      orderId: 200,
      user: superUser,
    });
    assert.equal(mixedResult.branchId, 1);
    assert.equal(mixedResult.tasks.length, 2);

    // 7d. completeReadyTasksForOrder completes ready tasks
    const completedTasks = await fulfillmentService.completeReadyTasksForOrder(200);
    assert.equal(completedTasks.length, 2);
    assert.equal(tasksInOrder.every((t) => t.status === 'completed'), true);

    // 7e. Repeated handover returns 409
    await assert.rejects(
      () => fulfillmentService.prepareHandoverToShipper({ orderId: 200, user: superUser }),
      (err) => err?.status === 409 && err?.code === 'FULFILLMENT_ALREADY_HANDED_OVER',
    );
  });

  // -------------------------------------------------------------
  // 8. PACKING/KITCHEN CANNOT BYPASS VIA /admin/orders/:id/status
  // -------------------------------------------------------------
  await t.test('updateOrderStatus enforces fulfillment handover and blocks mixed-lane bypass', async () => {
    postgresDb.setMockAdapter({ query: async () => [[], 0] });
    const origPrepare = defaultFulfillmentService.prepareHandoverToShipper;
    const origComplete = defaultFulfillmentService.completeReadyTasksForOrder;
    const origUpdateStatus = adminOrderService.updateStatus;

    let tasksCompleted = false;
    let orderStatusUpdated = false;

    try {
      // 8a. Packing role calls /admin/orders/:id/status with status: 'Đang giao'
      // while mixed-lane tasks are still preparing -> returns 409
      defaultFulfillmentService.prepareHandoverToShipper = async () => {
        const err = new Error('Chờ khâu còn lại: đơn hàng vẫn có nhiệm vụ chưa sẵn sàng');
        err.status = 409;
        err.code = 'FULFILLMENT_OTHER_LANE_NOT_READY';
        throw err;
      };

      let capturedStatus = 200;
      let capturedBody = null;
      const res409 = {
        status(code) { capturedStatus = code; return this; },
        json(data) { capturedBody = data; return this; },
      };

      await updateOrderStatus({
        params: { id: '300' },
        body: { status: 'Đang giao', driver_name: 'Nguyen Van A', driver_phone: '0901234567' },
        user: { sub: 2, role: 'packing', branch_id: 1 },
      }, res409);

      assert.equal(capturedStatus, 409);
      assert.equal(capturedBody.code, 'FULFILLMENT_OTHER_LANE_NOT_READY');

      // 8b. Kitchen role calls /admin/orders/:id/status with status: 'Đang giao'
      // while packing is still preparing -> returns 409
      capturedStatus = 200;
      capturedBody = null;
      await updateOrderStatus({
        params: { id: '300' },
        body: { status: 'Đang giao', driver_name: 'Nguyen Van B', driver_phone: '0907654321' },
        user: { sub: 3, role: 'kitchen', branch_id: 1 },
      }, res409);

      assert.equal(capturedStatus, 409);
      assert.equal(capturedBody.code, 'FULFILLMENT_OTHER_LANE_NOT_READY');

      // 8c. When all tasks ready -> handover succeeds exactly once
      defaultFulfillmentService.prepareHandoverToShipper = async () => {
        return { branchId: 1, tasks: [{ id: 1, status: 'ready' }, { id: 2, status: 'ready' }] };
      };
      adminOrderService.updateStatus = async (params) => {
        orderStatusUpdated = true;
        return { order_id: params.orderId, status: params.status };
      };
      defaultFulfillmentService.completeReadyTasksForOrder = async () => {
        tasksCompleted = true;
        return [{ id: 1, status: 'completed' }, { id: 2, status: 'completed' }];
      };

      let successStatus = 200;
      let successBody = null;
      const res200 = {
        status(code) { successStatus = code; return this; },
        json(data) { successBody = data; return this; },
      };

      await updateOrderStatus({
        params: { id: '300' },
        body: { status: 'Đang giao', driver_name: 'Nguyen Van A', driver_phone: '0901234567' },
        user: { sub: 2, role: 'packing', branch_id: 1 },
      }, res200);

      assert.equal(successStatus, 200);
      assert.equal(orderStatusUpdated, true);
      assert.equal(tasksCompleted, true);
      assert.equal(successBody.status, 'Đang giao');

      // 8d. Repeated handover returns 409
      defaultFulfillmentService.prepareHandoverToShipper = async () => {
        const err = new Error('Đơn hàng đã được bàn giao cho shipper hoặc không có nhiệm vụ sẵn sàng');
        err.status = 409;
        err.code = 'FULFILLMENT_ALREADY_HANDED_OVER';
        throw err;
      };

      let repeatedStatus = 200;
      let repeatedBody = null;
      const resRepeated = {
        status(code) { repeatedStatus = code; return this; },
        json(data) { repeatedBody = data; return this; },
      };

      await updateOrderStatus({
        params: { id: '300' },
        body: { status: 'Đang giao', driver_name: 'Nguyen Van A', driver_phone: '0901234567' },
        user: { sub: 2, role: 'packing', branch_id: 1 },
      }, resRepeated);

      assert.equal(repeatedStatus, 409);
      assert.equal(repeatedBody.code, 'FULFILLMENT_ALREADY_HANDED_OVER');
    } finally {
      postgresDb.resetMockAdapter();
      defaultFulfillmentService.prepareHandoverToShipper = origPrepare;
      defaultFulfillmentService.completeReadyTasksForOrder = origComplete;
      adminOrderService.updateStatus = origUpdateStatus;
    }
  });
});

test('Packing completion guard only permits orders already handed to shipper', () => {
  const beforeHandover = evaluateOrderTransition({
    currentStatus: 'Đang chuẩn bị',
    targetStatus: 'Hoàn thành',
    role: 'packing',
  });
  assert.equal(beforeHandover.allowed, false);
  assert.equal(beforeHandover.status, 400);

  const afterHandover = evaluateOrderTransition({
    currentStatus: 'Đang giao',
    targetStatus: 'Hoàn thành',
    role: 'packing',
  });
  assert.equal(afterHandover.allowed, true);
});

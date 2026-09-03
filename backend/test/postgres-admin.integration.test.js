import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { seedDemoData } from '../database/postgres/seed-demo.js';
import postgresDb from '../config/db-postgres.js';
import adminOrdersRepository, { AdminOrderError } from '../repositories/postgres/admin-orders.js';
import adminCatalogRepository from '../repositories/postgres/admin-catalog.js';
import adminStoresRepository, { AdminStoreError } from '../repositories/postgres/admin-stores.js';
import adminPromotionsRepository from '../repositories/postgres/admin-promotions.js';
import adminInventoryRepository from '../repositories/postgres/admin-inventory.js';
import adminReportsRepository from '../repositories/postgres/admin-reports.js';
import adminManagementRepository from '../repositories/postgres/admin-management.js';
import ordersRepository from '../repositories/postgres/orders.js';
import fulfillmentRepository from '../repositories/postgres/fulfillment.js';
import { hashOrderRequest } from '../services/order-idempotency.js';
import { evaluateOrderTransition } from '../services/order-transition-policy.js';

const enabled = process.env.POSTGRES_INTEGRATION === '1';
const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

function input(suffix, storeId = 1) {
  return {
    payment_method: 'COD', store_id: storeId, order_type: 'Take-away',
    customer_name: `Admin PG ${suffix}`, customer_phone: `091${String(suffix).padStart(7, '0').slice(-7)}`,
    items: [{ product_id: 1, qty: 1, size_id: 1, topping_ids: [1] }],
  };
}

async function createOrder(suffix, { storeId = 1, paymentProvider = 'cod' } = {}) {
  const request = input(suffix, storeId);
  return ordersRepository.createPublicOrder({
    input: request, idempotencyKey: `admin-pg-${suffix}-${paymentProvider}`,
    requestHash: hashOrderRequest(request), paymentProvider,
    cancelTokenHash: crypto.createHash('sha256').update(`cancel-${suffix}`).digest('hex'),
  });
}

describe('PostgreSQL admin domains suite', () => {
  it('enforces branch scope, payment filter, KDS visibility, and locked transitions', async (t) => {
    if (!enabled || !url) return t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');
    validatePostgresTestGuard(url);
    await postgresDb.close();
    await runMigrations();
    await seedDemoData();
    const suffix = Date.now() % 1_000_000;
    try {
      const storeOne = await createOrder(`${suffix}1`);
      const storeTwo = await createOrder(`${suffix}2`, { storeId: 2 });
      const payosOrder = await createOrder(`${suffix}3`, { paymentProvider: 'payos' });

      const branchOne = await adminOrdersRepository.list({ scopedStoreId: 1, limit: 100 });
      assert.ok(branchOne.some((row) => Number(row.id) === Number(storeOne.id)));
      assert.ok(!branchOne.some((row) => Number(row.id) === Number(storeTwo.id)));
      assert.equal(await adminOrdersRepository.detail({ orderId: storeTwo.id, scopedStoreId: 1 }), null);

      await assert.rejects(
        adminOrdersRepository.confirmPayment({ orderId: payosOrder.id, scopedStoreId: 1, actorId: null }),
        (err) => err instanceof AdminOrderError && /PayOS/.test(err.message),
      );
      await adminOrdersRepository.confirmPayment({ orderId: storeOne.id, scopedStoreId: 1, actorId: null });
      const kitchenOrders = await adminOrdersRepository.listKitchen({ scopedStoreId: 1 });
      assert.ok(kitchenOrders.some((row) => Number(row.id) === Number(storeOne.id)));
      assert.equal(kitchenOrders.find((row) => Number(row.id) === Number(storeOne.id)).items.length, 1);

      await assert.rejects(
        adminOrdersRepository.transition({
          orderId: storeOne.id, scopedStoreId: 1, targetStatus: 'Hoàn thành', actorId: null,
          actorRole: 'kitchen', evaluateTransition: evaluateOrderTransition,
        }),
        (err) => err instanceof AdminOrderError && err.code === 'FULFILLMENT_TASKS_INCOMPLETE',
      );

      const fulfillmentTasks = await fulfillmentRepository.getTasksForOrder(storeOne.id);
      assert.ok(fulfillmentTasks.length > 0);
      for (const task of fulfillmentTasks.filter((task) => task.status !== 'cancelled')) {
        const completed = await fulfillmentRepository.updateTaskStatus({
          taskId: task.id, status: 'completed', expectedStatus: task.status,
        });
        assert.equal(completed?.status, 'completed');
      }

      await adminOrdersRepository.transition({
        orderId: storeOne.id, scopedStoreId: 1, targetStatus: 'Hoàn thành', actorId: null,
        actorRole: 'kitchen', evaluateTransition: evaluateOrderTransition,
      });
      const completed = await adminOrdersRepository.detail({ orderId: storeOne.id, scopedStoreId: 1 });
      assert.equal(completed.current_status, 'Hoàn thành');

      const cancellable = await createOrder(`${suffix}4`);
      await adminOrdersRepository.confirmPayment({ orderId: cancellable.id, scopedStoreId: 1, actorId: null });
      await assert.rejects(
        adminOrdersRepository.cancel({ orderId: cancellable.id, scopedStoreId: 1, actorId: null, actorRole: 'cashier', evaluateTransition: evaluateOrderTransition }),
        (err) => err instanceof AdminOrderError && err.status === 403,
      );
      const cancelled = await adminOrdersRepository.cancel({ orderId: cancellable.id, scopedStoreId: 1, actorId: null, actorRole: 'manager', evaluateTransition: evaluateOrderTransition });
      assert.equal(cancelled.status, 'Đã hủy');
    } finally {
      await postgresDb.close();
    }
  });

  it('manages catalog, stores, tables, promotions, inventory, and reports', async (t) => {
    if (!enabled || !url) return t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL');
    validatePostgresTestGuard(url);
    await postgresDb.close();
    await runMigrations();
    await seedDemoData();
    const suffix = Date.now() % 1_000_000;
    try {
      // 1. Catalog CRUD
      const cat = await adminCatalogRepository.createCategory({ name: `Cat ${suffix}`, slug: `cat-${suffix}` });
      assert.ok(cat.id);
      const prod = await adminCatalogRepository.createProduct({
        category_id: cat.id, name: `Prod ${suffix}`, slug: `prod-${suffix}`,
        base_tea: 'Lục trà', price: 35000,
      });
      assert.ok(prod.id);
      const toggled = await adminCatalogRepository.setProductAvailability(prod.id, false);
      assert.equal(toggled.is_available, false);

      // 2. Stores & Tables CRUD
      const store = await adminStoresRepository.createBranch({
        name: `Branch ${suffix}`, city: 'Hà Nội', district: 'Cầu Giấy',
        address: '123 Cầu Giấy', phone: '0901234567',
      });
      assert.ok(store.id);
      const table1 = await adminStoresRepository.createTable({ store_id: store.id, name: 'Bàn 01' });
      assert.ok(table1.id);
      await assert.rejects(
        adminStoresRepository.createTable({ store_id: store.id, name: 'Bàn 1' }),
        (err) => err instanceof AdminStoreError,
      );

      // 3. Promotions CRUD
      const promo = await adminPromotionsRepository.createPromotion({
        title: `Promo ${suffix}`, type: 'discount', code: `TEST${suffix}`,
        discount_value: 10, discount_type: 'percent',
        start_date: '2026-01-01', end_date: '2026-12-31', store_ids: [store.id],
      });
      assert.ok(promo.id);
      const promoList = await adminPromotionsRepository.listPromotions({ scopedStoreId: store.id });
      assert.ok(promoList.some((p) => Number(p.id) === Number(promo.id)));

      // 4. Inventory
      const invList = await adminInventoryRepository.listInventory({ scopedStoreId: 1 });
      assert.ok(invList.length > 0);
      const invLogged = await adminInventoryRepository.logInventory(invList[0].id, {
        change_amount: 5, reason: 'Nhập hàng test', created_by: null, scopedStoreId: 1,
      });
      assert.equal(invLogged.change_amount, 5);

      // 5. Reports & Dashboard
      const kpi = await adminReportsRepository.getKPI({ scopedStoreId: 1 });
      assert.ok(typeof kpi.revenue.value === 'number');
      const urgent = await adminReportsRepository.getUrgent({ scopedStoreId: 1 });
      assert.ok(typeof urgent.low_stock === 'number');

      // 6. Management
      const accounts = await adminManagementRepository.listAccounts();
      assert.ok(accounts.length > 0);
      const notif = await adminManagementRepository.createNotification({
        user_id: accounts[0].id, title: `Test Notif ${suffix}`, type: 'system',
      });
      assert.ok(notif.id);
    } finally {
      await postgresDb.close();
    }
  });
});

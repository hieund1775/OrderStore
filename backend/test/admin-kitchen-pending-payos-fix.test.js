import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { createAdminOrderService } from '../services/orders/admin-order-service.js';
import adminKitchenRouter from '../routes/admin/kitchen.js';
import { authenticate } from '../middleware/auth.js';
import defaultPaymentAttemptsRepository from '../repositories/postgres/payment-attempts.js';

function makeToken(role, claims = {}) {
  return jwt.sign(
    {
      sub: claims.sub ?? 1,
      phone: claims.phone || '0909000001',
      role,
      admin_role: role,
      branch_id: claims.branch_id ?? 1,
      token_version: claims.token_version ?? 0,
      ...claims,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

describe('Admin Kitchen Orders - Pending PayOS Reconciliation Dependency Injection Fix', () => {
  describe('Deterministic Unit Tests for listKitchen Reconciliation', () => {
    it('1. listKitchen() with no pending PayOS orders does not invoke reconciliation and returns kitchen orders', async () => {
      let reconciliationInvoked = false;
      const mockAttemptsRepo = {
        async findCurrentAttemptForTarget() {
          reconciliationInvoked = true;
          return null;
        },
      };

      const mockRepo = {
        async listPendingPayOS({ scopedStoreId }) {
          assert.equal(scopedStoreId, 1);
          return [];
        },
        async listKitchen({ scopedStoreId }) {
          assert.equal(scopedStoreId, 1);
          return [
            { id: 101, store_id: scopedStoreId, items: [{ id: 1, product_name: 'Trà Đào' }] },
          ];
        },
      };

      const service = createAdminOrderService(mockRepo, mockAttemptsRepo);
      const result = await service.listKitchen({ storeId: 1 });

      assert.equal(result.length, 1);
      assert.equal(result[0].id, 101);
      assert.equal(reconciliationInvoked, false, 'Reconciliation should not be called when pending is empty');
    });

    it('2. listKitchen() with pending PayOS orders reaches findCurrentAttemptForTarget for every pending order and returns normally', async () => {
      const reconciliationTargetCalls = [];
      const mockAttemptsRepo = {
        async findCurrentAttemptForTarget({ orderId }) {
          reconciliationTargetCalls.push(orderId);
          // Return an inactive or non-matching attempt snapshot so reconciliation completes without provider calls
          return {
            id: 888,
            order_id: orderId,
            status: 'expired',
            payment_link_id: 'plink_test',
            payos_order_code: 123456,
          };
        },
      };

      const pendingOrders = [
        { id: 201, payment_provider: 'payos', payment_status: 'unpaid', store_id: 2 },
        { id: 202, payment_provider: 'payos', payment_status: 'expired', store_id: 2 },
      ];

      const mockRepo = {
        async listPendingPayOS({ scopedStoreId }) {
          assert.equal(scopedStoreId, 2);
          return pendingOrders;
        },
        async listKitchen({ scopedStoreId }) {
          assert.equal(scopedStoreId, 2);
          return [
            { id: 301, store_id: scopedStoreId, items: [{ id: 5, product_name: 'Trà Vải' }] },
          ];
        },
      };

      const service = createAdminOrderService(mockRepo, mockAttemptsRepo);
      const result = await service.listKitchen({ storeId: 2 });

      // Assertions
      assert.equal(result.length, 1);
      assert.equal(result[0].id, 301);
      assert.deepEqual(
        reconciliationTargetCalls,
        [201, 202],
        'Reconciliation must reach findCurrentAttemptForTarget for every pending order',
      );
    });

    it('3. Injected default payment attempts repository satisfies the required reconciliation interface', () => {
      assert.equal(
        typeof defaultPaymentAttemptsRepository.findCurrentAttemptForTarget,
        'function',
        'defaultPaymentAttemptsRepository must expose findCurrentAttemptForTarget',
      );
    });
  });

  describe('HTTP Route Authentication & Role Authorization Contract for GET /admin/kitchen/orders', () => {
    let server;
    let baseUrl;

    before(async () => {
      const app = express();
      app.use(express.json());
      app.use('/admin', (req, res, next) => {
        req.id = 'test-trace-id-123';
        next();
      });
      app.use('/admin', authenticate);
      app.use('/admin/kitchen', adminKitchenRouter);

      server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(async () => {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    it('4. Rejects request with 401 when Authorization header is missing', async () => {
      const res = await fetch(`${baseUrl}/admin/kitchen/orders`);
      assert.equal(res.status, 401);
    });

    it('5. Rejects unauthorized roles (e.g. cashier) with 403 Forbidden', async () => {
      const cashierToken = makeToken('cashier', { sub: 1 });
      const res = await fetch(`${baseUrl}/admin/kitchen/orders`, {
        headers: { Authorization: `Bearer ${cashierToken}` },
      });
      assert.equal(res.status, 403);
    });

    it('6. Authorizes Kitchen role with 200 OK', async () => {
      const kitchenToken = makeToken('kitchen', { sub: 1, branch_id: 1 });
      const res = await fetch(`${baseUrl}/admin/kitchen/orders`, {
        headers: { Authorization: `Bearer ${kitchenToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data));
    });

    it('7. Authorizes Manager role with 200 OK', async () => {
      const managerToken = makeToken('manager', { sub: 1, branch_id: 1 });
      const res = await fetch(`${baseUrl}/admin/kitchen/orders`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data));
    });

    it('8. Authorizes Super role with 200 OK', async () => {
      const superToken = makeToken('super', { sub: 1 });
      const res = await fetch(`${baseUrl}/admin/kitchen/orders`, {
        headers: { Authorization: `Bearer ${superToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data));
    });
  });
});

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import adminRoutes from '../routes/admin.js';
import db from '../config/db-postgres.js';

describe('KDS & Admin HTTP Integration Suite (Real Express Network Requests)', () => {
  let app;
  let server;
  let baseUrl;

  // Signed JWT tokens with store_id: 1
  const kitchenToken = jwt.sign({ sub: 101, username: 'bep1', role: 'kitchen', branch_id: 1 }, JWT_SECRET);
  const cashierToken = jwt.sign({ sub: 102, username: 'thu_ngan1', role: 'cashier', branch_id: 1 }, JWT_SECRET);
  const managerToken = jwt.sign({ sub: 103, username: 'quan_ly1', role: 'manager', branch_id: 1 }, JWT_SECRET);
  const superToken = jwt.sign({ sub: 104, username: 'admin', role: 'super' }, JWT_SECRET);

  // In-memory relational database state for integration testing
  let testOrders = [];
  let testStatusHistory = [];
  let testAuditLogs = [];

  function resetDbState() {
    testOrders = [
      { id: 1, store_id: 1, order_code: 'TP101', order_type: 'Take-away', payment_status: 'paid', cancel_reason: null },
      { id: 2, store_id: 1, order_code: 'TP102', order_type: 'Delivery', payment_status: 'unpaid', cancel_reason: null },
      { id: 3, store_id: 2, order_code: 'TP103', order_type: 'Take-away', payment_status: 'paid', cancel_reason: null }, // other branch
    ];
    testStatusHistory = [
      { id: 1, order_id: 1, status: 'Đang chuẩn bị', note: null, changed_by: 100, created_at: new Date() },
      { id: 2, order_id: 2, status: 'Chờ xác nhận', note: null, changed_by: 100, created_at: new Date() },
      { id: 3, order_id: 3, status: 'Đang chuẩn bị', note: null, changed_by: 100, created_at: new Date() },
    ];
    testAuditLogs = [];
  }

  const testDbAdapter = {
    async query(sqlText, params = []) {
      // 1) audit_logs
      if (sqlText.includes('audit_logs')) {
        testAuditLogs.push({ params, created_at: new Date() });
        return [[], 1];
      }

      // 2) orders query
      if (sqlText.includes('FROM orders') && sqlText.includes('SELECT')) {
        const orderId = Number(params[0]);
        let found = testOrders.filter((o) => o.id === orderId);
        if (params.length > 1 && params[1]) {
          found = found.filter((o) => o.store_id === Number(params[1]));
        }
        return [found, found.length];
      }

      // 3) order_status_history
      if (sqlText.includes('FROM order_status_history')) {
        const orderId = Number(params[0]);
        const history = testStatusHistory
          .filter((h) => h.order_id === orderId)
          .sort((a, b) => b.id - a.id);
        return [history.slice(0, 1), history.length];
      }

      return [[], 0];
    },

    async transaction(fn) {
      const tx = {
        async query(sqlText, params = []) {
          // 1) SELECT orders
          if (sqlText.includes('FROM orders') && sqlText.includes('SELECT')) {
            const orderId = Number(params[0]);
            let found = testOrders.filter((o) => o.id === orderId);
            if (params.length > 1 && params[1]) {
              found = found.filter((o) => o.store_id === Number(params[1]));
            }
            return [found, found.length];
          }

          // 2) SELECT status history
          if (sqlText.includes('FROM order_status_history') && sqlText.includes('SELECT')) {
            const orderId = Number(params[0]);
            const history = testStatusHistory
              .filter((h) => h.order_id === orderId)
              .sort((a, b) => b.id - a.id);
            return [history.slice(0, 1), history.length];
          }

          // 3) INSERT into order_status_history
          if (sqlText.includes('INSERT INTO order_status_history')) {
            const orderId = Number(params[0]);
            const status = params[1];
            const note = params[2] || null;
            const changed_by = params[3] ? Number(params[3]) : null;

            const newEntry = {
              id: testStatusHistory.length + 1,
              order_id: orderId,
              status,
              note,
              changed_by,
              created_at: new Date(),
            };
            testStatusHistory.push(newEntry);
            return [[], 1];
          }

          // 4) UPDATE orders
          if (sqlText.includes('UPDATE orders')) {
            const orderId = Number(params[0]);
            const order = testOrders.find((o) => o.id === orderId);
            if (order && sqlText.includes('cancel_reason')) {
              order.cancel_reason = params[1];
            }
            return [[], 1];
          }

          return [[], 0];
        },
      };

      return fn(tx);
    },
  };

  before(async () => {
    db.setMockAdapter(testDbAdapter);

    app = express();
    app.use(express.json());
    app.use('/admin', adminRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    db.resetMockAdapter();
    await new Promise((resolve) => server.close(resolve));
  });

  it('R5-B01: sends real HTTP PATCH /admin/orders/1/status with Kitchen token to complete cooking (KDS Contract)', async () => {
    resetDbState();

    const response = await fetch(`${baseUrl}/admin/orders/1/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kitchenToken}`,
      },
      body: JSON.stringify({ status: 'Hoàn thành' }),
    });

    const body = await response.json();
    assert.equal(response.status, 200, `Expected HTTP 200, got ${response.status}: ${JSON.stringify(body)}`);
    assert.equal(body.order_id, 1);
    assert.equal(body.status, 'Hoàn thành');

    // Verify exactly one new transition was recorded in the database
    const history = testStatusHistory.filter((h) => h.order_id === 1);
    assert.equal(history.length, 2); // Initial 'Đang chuẩn bị' + New 'Hoàn thành'
    const latest = history[history.length - 1];
    assert.equal(latest.status, 'Hoàn thành');
    assert.equal(latest.changed_by, 101); // Sub of kitchenToken
  });

  it('R5-B01: rejects kitchen token from cancelling order with HTTP 403 Forbidden', async () => {
    resetDbState();

    const response = await fetch(`${baseUrl}/admin/orders/1/cancel`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kitchenToken}`,
      },
      body: JSON.stringify({ reason: 'Kitchen attempt to cancel' }),
    });

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.match(body.error, /không có quyền/i);
  });

  it('R5-B01: rejects cashier token from completing order with HTTP 403 Forbidden', async () => {
    resetDbState();

    const response = await fetch(`${baseUrl}/admin/orders/1/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({ status: 'Hoàn thành' }),
    });

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.match(body.error, /không có quyền/i);
  });

  it('R5-B01: rejects cashier token from cancelling paid order with HTTP 403 Forbidden', async () => {
    resetDbState();

    const response = await fetch(`${baseUrl}/admin/orders/1/cancel`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({ reason: 'Cashier attempt to cancel paid order' }),
    });

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.match(body.error, /chỉ Quản lý hoặc Super Admin|chỉ super\/manager/i);
  });

  it('R5-B01: allows manager token to cancel paid order with HTTP 200 OK', async () => {
    resetDbState();

    const response = await fetch(`${baseUrl}/admin/orders/1/cancel`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ reason: 'Manager cancelled paid order due to out of stock' }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'Đã hủy');

    // Verify order was marked cancelled in database
    const order = testOrders.find((o) => o.id === 1);
    assert.equal(order.cancel_reason, 'Manager cancelled paid order due to out of stock');
  });

  it('R5-B01: isolates branch access - kitchen cannot access other branch orders (HTTP 404/403)', async () => {
    resetDbState();

    // Order 3 belongs to branch 2. Kitchen token belongs to branch 1.
    const response = await fetch(`${baseUrl}/admin/orders/3/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kitchenToken}`,
      },
      body: JSON.stringify({ status: 'Hoàn thành' }),
    });

    assert.equal(response.status, 404);
    const body = await response.json();
    assert.match(body.error, /không tìm thấy/i);
  });
});

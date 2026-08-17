import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import adminRoutes from '../routes/admin.js';
import db from '../config/db.js';
import { encodeCursor } from '../services/cursor-pagination.js';

describe('Admin Orders Cursor Pagination & Scope Suite (Real Express Network Requests)', () => {
  let app;
  let server;
  let baseUrl;

  const superToken = jwt.sign({ sub: 1, username: 'admin', role: 'super' }, JWT_SECRET);
  const managerTokenBranch1 = jwt.sign({ sub: 2, username: 'm1', role: 'manager', branch_id: 1 }, JWT_SECRET);

  // Test dataset with specific timestamps and tie-break IDs
  let testOrders = [];

  function resetOrders() {
    testOrders = [
      { id: 105, store_id: 1, order_code: 'TP105', total: 50000, created_at: new Date('2026-08-17T12:00:00.000Z') },
      { id: 104, store_id: 1, order_code: 'TP104', total: 40000, created_at: new Date('2026-08-17T11:00:00.000Z') },
      // Equal timestamp for tie-breaking test
      { id: 103, store_id: 1, order_code: 'TP103', total: 30000, created_at: new Date('2026-08-17T10:00:00.000Z') },
      { id: 102, store_id: 1, order_code: 'TP102', total: 20000, created_at: new Date('2026-08-17T10:00:00.000Z') },
      { id: 101, store_id: 2, order_code: 'TP101', total: 10000, created_at: new Date('2026-08-17T09:00:00.000Z') }, // Branch 2
    ];
  }

  const mockDbAdapter = {
    async query(sqlText, params = []) {
      if (sqlText.includes('FROM orders') && sqlText.includes('SELECT')) {
        let filtered = [...testOrders];

        // Store scope filter
        const storeIdMatch = sqlText.match(/o\.store_id\s*=\s*\?/);
        if (storeIdMatch) {
          // If query has store_id filter, find its param index
          const storeParam = params.find((p, idx) => idx > 0 && typeof p === 'number');
          if (storeParam) {
            filtered = filtered.filter((o) => o.store_id === storeParam);
          }
        }

        // Cursor filter: (o.created_at < ? OR (o.created_at = ? AND o.id < ?))
        if (sqlText.includes('o.created_at < ?')) {
          const cursorCreatedAt = new Date(params[params.length - 3]);
          const cursorId = Number(params[params.length - 1]);

          filtered = filtered.filter((o) => {
            const oTime = o.created_at.getTime();
            const cTime = cursorCreatedAt.getTime();
            return oTime < cTime || (oTime === cTime && o.id < cursorId);
          });
        }

        filtered.sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id - a.id);

        const limit = typeof params[0] === 'number' ? params[0] : 50;
        const page = filtered.slice(0, limit);

        const rows = page.map((o) => ({
          ...o,
          store_name: `Store #${o.store_id}`,
          current_status: 'Đang chuẩn bị',
        }));

        return [rows, rows.length];
      }

      return [[], 0];
    },
  };

  before(async () => {
    db.setMockAdapter(mockDbAdapter);

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

  it('paginates admin orders with limit and next_cursor metadata', async () => {
    resetOrders();

    // Page 1: limit 2
    const res1 = await fetch(`${baseUrl}/admin/orders?limit=2`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.equal(res1.status, 200);
    const data1 = await res1.json();

    assert.equal(data1.orders.length, 2);
    assert.equal(data1.orders[0].id, 105);
    assert.equal(data1.orders[1].id, 104);
    assert.equal(data1.page_info.has_more, true);
    assert.ok(data1.page_info.next_cursor);

    // Page 2: with cursor from page 1
    const res2 = await fetch(`${baseUrl}/admin/orders?limit=2&cursor=${encodeURIComponent(data1.page_info.next_cursor)}`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.equal(res2.status, 200);
    const data2 = await res2.json();

    assert.equal(data2.orders.length, 2);
    // Verifies tie-breaking on equal timestamps (103 and 102 have same created_at)
    assert.equal(data2.orders[0].id, 103);
    assert.equal(data2.orders[1].id, 102);
  });

  it('guarantees deterministic traversal when a new order is inserted between pages', async () => {
    resetOrders();

    // Step 1: Fetch Page 1
    const res1 = await fetch(`${baseUrl}/admin/orders?limit=2`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const data1 = await res1.json();
    assert.equal(data1.orders[0].id, 105);
    assert.equal(data1.orders[1].id, 104);

    // Step 2: Insert a NEW order with newest timestamp into database
    testOrders.unshift({
      id: 999,
      store_id: 1,
      order_code: 'TP999_NEW',
      total: 99000,
      created_at: new Date('2026-08-17T13:00:00.000Z'),
    });

    // Step 3: Fetch Page 2 using cursor from Page 1
    const res2 = await fetch(`${baseUrl}/admin/orders?limit=2&cursor=${encodeURIComponent(data1.page_info.next_cursor)}`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const data2 = await res2.json();

    // Verifies Page 2 continues cleanly with 103 and 102 WITHOUT repeating 104 or missing 103!
    assert.equal(data2.orders[0].id, 103);
    assert.equal(data2.orders[1].id, 102);
  });

  it('rejects malformed cursor with HTTP 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/admin/orders?cursor=invalid-garbage-token`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /cursor.*không hợp lệ/i);
  });

  it('enforces branch isolation during pagination for manager', async () => {
    resetOrders();

    const res = await fetch(`${baseUrl}/admin/orders?limit=10`, {
      headers: { Authorization: `Bearer ${managerTokenBranch1}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    // Manager branch 1 must ONLY see branch 1 orders (105, 104, 103, 102) and NOT branch 2 (101)
    const branchIds = data.orders.map((o) => o.store_id);
    assert.ok(branchIds.every((id) => id === 1));
    assert.equal(data.orders.some((o) => o.id === 101), false);
  });
});

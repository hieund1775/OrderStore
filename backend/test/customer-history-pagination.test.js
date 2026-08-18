import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import publicRoutes from '../routes/public.js';
import db from '../config/db-postgres.js';
import {
  encodeCursor,
  decodeCursor,
  validatePaginationLimit,
  buildPageInfo,
  CursorValidationError,
} from '../services/cursor-pagination.js';
import { batchLoadOrderDetails } from '../services/order-batch-loader.js';

describe('Customer History & Cursor Pagination Service Suite', () => {
  it('encodes and decodes pagination cursor deterministically', () => {
    const createdAt = new Date('2026-08-17T10:30:00.000Z');
    const cursor = encodeCursor({ createdAt, id: 1234 });

    assert.ok(cursor);
    assert.equal(typeof cursor, 'string');

    const decoded = decodeCursor(cursor);
    assert.equal(decoded.id, 1234);
    assert.equal(decoded.createdAt.toISOString(), createdAt.toISOString());
  });

  it('rejects malformed or tampered cursor with 400 status error', () => {
    assert.throws(
      () => decodeCursor('invalid-base64-random-string'),
      (err) => err instanceof CursorValidationError && err.status === 400
    );

    // Missing fields in valid base64 json
    const badPayload = Buffer.from(JSON.stringify({ c: '2026-01-01' })).toString('base64url');
    assert.throws(
      () => decodeCursor(badPayload),
      (err) => err instanceof CursorValidationError && err.status === 400
    );
  });

  it('validates pagination limit within boundary (1 to 100)', () => {
    assert.equal(validatePaginationLimit(undefined), 50); // Default 50
    assert.equal(validatePaginationLimit('25'), 25);
    assert.equal(validatePaginationLimit(100), 100);

    assert.throws(
      () => validatePaginationLimit(0),
      (err) => err instanceof CursorValidationError && err.status === 400
    );
    assert.throws(
      () => validatePaginationLimit(150),
      (err) => err instanceof CursorValidationError && err.status === 400
    );
  });

  it('builds page_info with has_more and next_cursor accurately', () => {
    const rows = [
      { id: 1, created_at: new Date('2026-08-17T12:00:00Z') },
      { id: 2, created_at: new Date('2026-08-17T11:00:00Z') },
      { id: 3, created_at: new Date('2026-08-17T10:00:00Z') }, // 3 rows, limit 2 -> has_more = true
    ];

    const result = buildPageInfo({ rows, limit: 2 });
    assert.equal(result.rows.length, 2);
    assert.equal(result.page_info.has_more, true);
    assert.ok(result.page_info.next_cursor);

    const nextDecoded = decodeCursor(result.page_info.next_cursor);
    assert.equal(nextDecoded.id, 2);
  });

  it('proves batchLoadOrderDetails executes EXACTLY 2 queries for 50 orders (eliminating N+1)', async () => {
    const executedQueries = [];

    const mockQuery = async (sqlText, params = []) => {
      executedQueries.push({ sql: sqlText, params });

      if (sqlText.includes('FROM order_items')) {
        const orderIds = Array.isArray(params[0]) ? params[0] : params;
        const items = [];
        for (const orderId of orderIds) {
          items.push({ id: orderId * 10 + 1, order_id: orderId, product_id: 1, product_name: 'Trà Sữa', qty: 1, unit_price: 30000 });
          items.push({ id: orderId * 10 + 2, order_id: orderId, product_id: 2, product_name: 'Trà Đào', qty: 1, unit_price: 35000 });
        }
        return [items, items.length];
      }

      if (sqlText.includes('FROM order_item_toppings')) {
        const itemIds = Array.isArray(params[0]) ? params[0] : params;
        const toppings = [];
        for (const itemId of itemIds) {
          toppings.push({ id: itemId * 100 + 1, order_item_id: itemId, topping_name: 'Trân châu', topping_price: 5000 });
        }
        return [toppings, toppings.length];
      }

      return [[], 0];
    };

    // Simulate 50 orders
    const orders = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, order_code: `TP${i + 1}` }));

    const enriched = await batchLoadOrderDetails(orders, mockQuery);

    assert.equal(enriched.length, 50);
    assert.equal(enriched[0].items.length, 2);
    assert.equal(enriched[0].items[0].toppings.length, 1);
    assert.equal(enriched[49].items.length, 2);

    // CRITICAL ASSERTION: Exactly 2 batch queries executed instead of 50 individual queries
    assert.equal(executedQueries.length, 2, 'Must execute exactly 2 queries (1 items + 1 toppings) for 50 orders');
  });

  it('handles 0 orders with 0 database queries', async () => {
    let queryCount = 0;
    const mockQuery = async () => {
      queryCount++;
      return [[], 0];
    };

    const emptyResult = await batchLoadOrderDetails([], mockQuery);
    assert.deepEqual(emptyResult, []);
    assert.equal(queryCount, 0);
  });
});

describe('Customer History HTTP Integration Suite (Real Express Network Requests)', () => {
  let app;
  let server;
  let baseUrl;

  const customer1Token = jwt.sign({ sub: 10, username: 'customer1' }, JWT_SECRET);
  const customer2Token = jwt.sign({ sub: 20, username: 'customer2' }, JWT_SECRET);

  let testOrders = [];
  let queryHistory = [];

  function resetOrders() {
    testOrders = [
      { id: 205, user_id: 10, store_id: 1, order_code: 'TP205', total: 50000, created_at: new Date('2026-08-17T12:00:00.000Z') },
      { id: 204, user_id: 10, store_id: 1, order_code: 'TP204', total: 40000, created_at: new Date('2026-08-17T11:00:00.000Z') },
      // Equal timestamp for tie-breaking test
      { id: 203, user_id: 10, store_id: 1, order_code: 'TP203', total: 30000, created_at: new Date('2026-08-17T10:00:00.000Z') },
      { id: 202, user_id: 10, store_id: 1, order_code: 'TP202', total: 20000, created_at: new Date('2026-08-17T10:00:00.000Z') },
      { id: 201, user_id: 10, store_id: 1, order_code: 'TP201', total: 10000, created_at: new Date('2026-08-17T09:00:00.000Z') },
    ];
  }

  const mockDbAdapter = {
    async query(sqlText, params = []) {
      queryHistory.push({ sql: sqlText, params });

      // 1) Orders list query
      if (sqlText.includes('FROM orders o') && sqlText.includes('WHERE o.user_id = $1')) {
        const limit = Number(params.at(-1));
        const targetUserId = Number(params[0]);

        let filtered = testOrders.filter((o) => o.user_id === targetUserId);

        // Cursor filter: (o.created_at < ? OR (o.created_at = ? AND o.id < ?))
        if (sqlText.includes('o.created_at < $2')) {
          const cursorCreatedAt = new Date(params[1]);
          const cursorId = Number(params[2]);

          filtered = filtered.filter((o) => {
            const oTime = o.created_at.getTime();
            const cTime = cursorCreatedAt.getTime();
            return oTime < cTime || (oTime === cTime && o.id < cursorId);
          });
        }

        filtered.sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id - a.id);
        const page = filtered.slice(0, limit);

        const rows = page.map((o) => ({
          ...o,
          store_name: `Chi nhánh ${o.store_id}`,
          current_status: 'Đang chuẩn bị',
        }));

        return [rows, rows.length];
      }

      // 2) Batch items query
      if (sqlText.includes('FROM order_items') && sqlText.includes('WHERE order_id = ANY')) {
        const items = [];
        for (const orderId of params[0]) {
          items.push({
            id: orderId * 10 + 1,
            order_id: orderId,
            product_id: 1,
            product_name: 'Trà Sữa Khoai Môn',
            qty: 1,
            size_label: 'M',
            unit_price: 35000,
            line_total: 35000,
          });
        }
        return [items, items.length];
      }

      // 3) Batch toppings query
      if (sqlText.includes('FROM order_item_toppings') && sqlText.includes('WHERE order_item_id = ANY')) {
        const toppings = [];
        for (const itemId of params[0]) {
          toppings.push({
            id: itemId * 100 + 1,
            order_item_id: itemId,
            topping_name: 'Trân Châu Hoàng Gia',
            topping_price: 5000,
          });
        }
        return [toppings, toppings.length];
      }

      return [[], 0];
    },
  };

  before(async () => {
    db.setMockAdapter(mockDbAdapter);

    app = express();
    app.use(express.json());
    app.use('/api', publicRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    db.resetMockAdapter();
    await new Promise((resolve) => server.close(resolve));
  });

  it('paginates customer history with limit and cursor, asserting constant 3 queries total', async () => {
    resetOrders();
    queryHistory = [];

    // Page 1: limit 2
    const res1 = await fetch(`${baseUrl}/api/users/10/orders?limit=2`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    assert.equal(res1.status, 200);
    const data1 = await res1.json();

    assert.equal(data1.orders.length, 2);
    assert.equal(data1.orders[0].id, 205);
    assert.equal(data1.orders[1].id, 204);
    assert.equal(data1.orders[0].items.length, 1);
    assert.equal(data1.orders[0].items[0].toppings.length, 1);
    assert.equal(data1.page_info.has_more, true);
    assert.ok(data1.page_info.next_cursor);

    // Assert exactly 3 batched queries for Page 1
    assert.equal(queryHistory.length, 3, 'Must execute exactly 3 queries (1 orders + 1 items + 1 toppings)');

    // Page 2: with cursor from page 1
    queryHistory = [];
    const res2 = await fetch(
      `${baseUrl}/api/users/10/orders?limit=2&cursor=${encodeURIComponent(data1.page_info.next_cursor)}`,
      {
        headers: { Authorization: `Bearer ${customer1Token}` },
      }
    );
    assert.equal(res2.status, 200);
    const data2 = await res2.json();

    assert.equal(data2.orders.length, 2);
    // Verifies tie-breaking on equal timestamps (203 and 202)
    assert.equal(data2.orders[0].id, 203);
    assert.equal(data2.orders[1].id, 202);
    assert.equal(queryHistory.length, 3);
  });

  it('guarantees deterministic customer traversal when a new order is inserted between pages', async () => {
    resetOrders();

    // Step 1: Fetch Page 1
    const res1 = await fetch(`${baseUrl}/api/users/10/orders?limit=2`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    const data1 = await res1.json();
    assert.equal(data1.orders[0].id, 205);
    assert.equal(data1.orders[1].id, 204);

    // Step 2: Insert a NEW order for customer 10 with latest timestamp
    testOrders.unshift({
      id: 999,
      user_id: 10,
      store_id: 1,
      order_code: 'TP999_NEW',
      total: 88000,
      created_at: new Date('2026-08-17T13:00:00.000Z'),
    });

    // Step 3: Fetch Page 2 using cursor from Page 1
    const res2 = await fetch(
      `${baseUrl}/api/users/10/orders?limit=2&cursor=${encodeURIComponent(data1.page_info.next_cursor)}`,
      {
        headers: { Authorization: `Bearer ${customer1Token}` },
      }
    );
    const data2 = await res2.json();

    // Verifies Page 2 continues cleanly with 203 and 202 WITHOUT duplicate 204 or skipping 203!
    assert.equal(data2.orders[0].id, 203);
    assert.equal(data2.orders[1].id, 202);
  });

  it('enforces customer ownership isolation (HTTP 403 Forbidden for other customers)', async () => {
    // Customer 20 tries to access Customer 10's orders
    const res = await fetch(`${baseUrl}/api/users/10/orders`, {
      headers: { Authorization: `Bearer ${customer2Token}` },
    });
    assert.equal(res.status, 403);
  });

  it('returns array format when neither limit nor cursor is requested (backwards compatibility)', async () => {
    resetOrders();

    const res = await fetch(`${baseUrl}/api/users/10/orders`, {
      headers: { Authorization: `Bearer ${customer1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(Array.isArray(data), true, 'Must return array for legacy callers');
    assert.equal(data.length, 5);
  });
});

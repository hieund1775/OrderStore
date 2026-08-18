import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import adminRoutes from '../routes/admin.js';
import db from '../config/db-postgres.js';

describe('KDS Batch Query & Query Count Optimization Suite', () => {
  let app;
  let server;
  let baseUrl;

  const kitchenToken = jwt.sign({ sub: 101, username: 'bep1', role: 'kitchen', branch_id: 1 }, JWT_SECRET);

  // Generate 50 active kitchen orders for branch 1 + 1 order for branch 2
  const mockOrders = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    order_code: `TP_KITCHEN_${i + 1}`,
    store_id: 1,
    order_type: 'Take-away',
    payment_status: 'paid',
    customer_name: `Customer ${i + 1}`,
    customer_phone: '0901234567',
    total: 45000,
    created_at: new Date('2026-08-17T10:00:00.000Z'),
    store_name: 'Chi nhánh 1',
    current_status: 'Đang chuẩn bị',
  }));

  const mockOrdersBranch2 = [
    {
      id: 999,
      order_code: 'TP_BRANCH2',
      store_id: 2,
      order_type: 'Delivery',
      payment_status: 'paid',
      customer_name: 'Khách Chi Nhánh 2',
      customer_phone: '0909999999',
      total: 60000,
      created_at: new Date('2026-08-17T10:00:00.000Z'),
      store_name: 'Chi nhánh 2',
      current_status: 'Đang chuẩn bị',
    },
  ];

  let queryLog = [];

  const instrumentedDbAdapter = {
    async query(sqlText, params = []) {
      queryLog.push({ sql: sqlText, params });

      // 1) Orders list query
      if (sqlText.includes('FROM orders o JOIN stores s')) {
        const storeParam = params.find((p) => typeof p === 'number');
        if (storeParam === 1) {
          return [mockOrders, mockOrders.length];
        }
        if (storeParam === 2) {
          return [mockOrdersBranch2, mockOrdersBranch2.length];
        }
        return [[...mockOrders, ...mockOrdersBranch2], mockOrders.length + mockOrdersBranch2.length];
      }

      // 2) Batch items query: WHERE order_id IN (?, ...) or WHERE order_id = ANY($1)
      if (sqlText.includes('FROM order_items') && (sqlText.includes('WHERE order_id IN') || sqlText.includes('WHERE order_id = ANY'))) {
        const orderIds = Array.isArray(params[0]) ? params[0] : params;
        const items = [];
        for (const orderId of orderIds) {
          items.push({
            id: orderId * 10 + 1,
            order_id: orderId,
            product_id: 1,
            product_name: 'Trà Sữa Trân Châu',
            qty: 2,
            size_label: 'L',
            unit_price: 35000,
            line_total: 70000,
          });
        }
        return [items, items.length];
      }

      // 3) Batch toppings query: WHERE order_item_id IN (?, ...) or WHERE order_item_id = ANY($1)
      if (sqlText.includes('FROM order_item_toppings') && (sqlText.includes('WHERE order_item_id IN') || sqlText.includes('WHERE order_item_id = ANY'))) {
        const itemIds = Array.isArray(params[0]) ? params[0] : params;
        const toppings = [];
        for (const itemId of itemIds) {
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
    db.setMockAdapter(instrumentedDbAdapter);

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

  it('fetches 50 KDS orders with EXACTLY 3 constant queries (1 orders + 1 items + 1 toppings)', async () => {
    queryLog = [];

    const response = await fetch(`${baseUrl}/admin/kitchen/orders`, {
      headers: { Authorization: `Bearer ${kitchenToken}` },
    });

    assert.equal(response.status, 200);
    const orders = await response.json();

    assert.equal(orders.length, 50);
    assert.equal(orders[0].items.length, 1);
    assert.equal(orders[0].items[0].toppings.length, 1);
    assert.equal(orders[0].items[0].toppings[0].name, 'Trân Châu Hoàng Gia');

    // CRITICAL ASSERTION: Exactly 3 queries for 50 orders!
    assert.equal(
      queryLog.length,
      3,
      `Expected exactly 3 queries, but got ${queryLog.length}. Details: ${JSON.stringify(queryLog.map((q) => q.sql))}`
    );
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createAdminPosRouter } from '../routes/admin/pos.js';

async function start(user, orderService) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = user; next(); });
  app.use('/admin/pos', createAdminPosRouter({
    orderService,
    auditLogger: async () => {},
  }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const basePayload = {
  store_id: 1,
  table_id: null,
  order_type: 'Delivery',
  source: 'online',
  payment_method: 'VietQR',
  items: [{ product_id: 1, qty: 1 }],
};

test('POS rejects a Manager attempt to create an order for another branch', async () => {
  let calls = 0;
  const fixture = await start({ role: 'manager', sub: 12, branch_id: 1 }, {
    create: async () => { calls += 1; return {}; },
  });
  try {
    const response = await fetch(`${fixture.baseUrl}/admin/pos/orders`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...basePayload, store_id: 2 }),
    });
    assert.equal(response.status, 403);
    assert.equal(calls, 0);
  } finally { await fixture.close(); }
});

test('POS pins cashier orders to the authenticated branch and canonical POS COD fields', async () => {
  let received = null;
  const fixture = await start({ role: 'cashier', sub: 13, branch_id: 1 }, {
    create: async (payload) => {
      received = payload;
      return { order_code: 'POS-1', replay: false };
    },
  });
  try {
    const response = await fetch(`${fixture.baseUrl}/admin/pos/orders`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'pos-key' },
      body: JSON.stringify(basePayload),
    });
    assert.equal(response.status, 201);
    assert.equal(received.userId, null);
    assert.equal(received.idempotencyKey, 'pos-key');
    assert.equal(received.input.store_id, 1);
    assert.equal(received.input.source, 'pos');
    assert.equal(received.input.order_type, 'POS');
    assert.equal(received.input.payment_method, 'COD');
    assert.equal(received.input.delivery_addr, null);
  } finally { await fixture.close(); }
});

test('POS lets Super select the target branch', async () => {
  let received = null;
  const fixture = await start({ role: 'super', sub: 1, branch_id: null }, {
    create: async (payload) => { received = payload; return { order_code: 'POS-2', replay: false }; },
  });
  try {
    const response = await fetch(`${fixture.baseUrl}/admin/pos/orders`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...basePayload, store_id: 2 }),
    });
    assert.equal(response.status, 201);
    assert.equal(received.input.store_id, 2);
  } finally { await fixture.close(); }
});

test('POS denies kitchen and packing roles', async () => {
  for (const role of ['kitchen', 'packing']) {
    const fixture = await start({ role, sub: 20, branch_id: 1 }, { create: async () => ({}) });
    try {
      const response = await fetch(`${fixture.baseUrl}/admin/pos/orders`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(basePayload),
      });
      assert.equal(response.status, 403);
    } finally { await fixture.close(); }
  }
});

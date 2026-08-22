import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { JWT_SECRET } from '../config/env.js';
import ordersRepository from '../repositories/postgres/orders.js';

describe('Orders Auth Gate & Ownership Suite', () => {
  let server;
  let baseUrl;
  let originalCreatePublicOrder;

  const customerToken = jwt.sign({ id: 10, sub: 10, role: 'customer', phone: '0901234567' }, JWT_SECRET);

  before(async () => {
    originalCreatePublicOrder = ordersRepository.createPublicOrder;
    ordersRepository.createPublicOrder = async ({ userId, source, customerPhone, customerName }) => {
      return {
        id: 999,
        order_code: 'TP999999',
        user_id: userId,
        customer_name: customerName,
        customer_phone: customerPhone,
        total: 50000,
        payment_method: 'COD',
        payment_status: 'unpaid',
      };
    };

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    ordersRepository.createPublicOrder = originalCreatePublicOrder;
    await new Promise((resolve) => server.close(resolve));
  });

  it('rejects online order creation from anonymous customer with 401 and clear message', async () => {
    const payload = {
      store_id: 1,
      customer_name: 'Nguyễn Văn An',
      customer_phone: '0901234567',
      order_type: 'Take-away',
      payment_method: 'COD',
      items: [{ product_id: 1, qty: 1 }],
      source: 'online',
    };

    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /đăng nhập tài khoản/i);
  });

  it('accepts online order creation when customer Bearer token is provided', async () => {
    const payload = {
      store_id: 1,
      customer_name: 'Nguyễn Văn An',
      customer_phone: '0901234567',
      order_type: 'Take-away',
      payment_method: 'COD',
      items: [{ product_id: 1, qty: 1 }],
      source: 'online',
    };

    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${customerToken}`,
        'idempotency-key': 'auth-test-key-1',
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.user_id, 10);
  });

  it('allows counter POS orders without customer token for guest in-store checkout', async () => {
    const payload = {
      store_id: 1,
      customer_name: 'Khách Hàng',
      customer_phone: '0901234567',
      order_type: 'Take-away',
      payment_method: 'COD',
      items: [{ product_id: 1, qty: 1 }],
      source: 'pos',
    };

    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'pos-test-key-1',
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.user_id, null);
  });
});

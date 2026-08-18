import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { JWT_SECRET } from '../config/env.js';
import adminOrdersRepository from '../repositories/postgres/admin-orders.js';
import ordersRepository, { OrderError } from '../repositories/postgres/orders.js';
import { asyncHandler } from '../middleware/async-handler.js';

const managerToken = jwt.sign({ sub: 1, role: 'manager' }, JWT_SECRET);
const validPosOrder = {
  store_id: 1,
  customer_name: 'Validation test',
  customer_phone: '0900000000',
  items: [{ product_id: 1, qty: 1 }],
  source: 'pos',
  payment_method: 'COD',
};

describe('Phase 3 order error and validation HTTP contract', () => {
  let server;
  let baseUrl;
  let originals;

  before(async () => {
    originals = {
      detail: adminOrdersRepository.detail,
      transition: adminOrdersRepository.transition,
      createPublicOrder: ordersRepository.createPublicOrder,
    };
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    Object.assign(adminOrdersRepository, { detail: originals.detail, transition: originals.transition });
    ordersRepository.createPublicOrder = originals.createPublicOrder;
    await new Promise((resolve) => server.close(resolve));
  });

  it('rejects malformed order identifiers before calling an admin repository', async () => {
    let calls = 0;
    adminOrdersRepository.detail = async () => { calls += 1; return null; };
    const response = await fetch(`${baseUrl}/admin/orders/not-an-id`, {
      headers: { authorization: `Bearer ${managerToken}` },
    });

    assert.equal(response.status, 400);
    assert.equal(calls, 0);
    assert.equal((await response.json()).error, 'ID đơn hàng phải là số nguyên dương');
  });

  it('rejects invalid status, note, and create-order identifiers before repositories', async () => {
    let transitionCalls = 0;
    let createCalls = 0;
    adminOrdersRepository.transition = async () => { transitionCalls += 1; return {}; };
    ordersRepository.createPublicOrder = async () => { createCalls += 1; return {}; };

    const status = await fetch(`${baseUrl}/admin/orders/1/status`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${managerToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'invalid' }),
    });
    const note = await fetch(`${baseUrl}/admin/orders/1/status`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${managerToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'Đang chuẩn bị', note: 'x'.repeat(501) }),
    });
    const create = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'invalid-order' },
      body: JSON.stringify({ ...validPosOrder, store_id: 'bad-id' }),
    });

    assert.equal(status.status, 400);
    assert.equal(note.status, 400);
    assert.equal(create.status, 400);
    assert.equal(transitionCalls, 0);
    assert.equal(createCalls, 0);
  });

  it('keeps known business failures at their intended status and stable code', async () => {
    const businessError = new OrderError('Idempotency key belongs to a different request', 409, 'ORDER_IDEMPOTENCY_CONFLICT');
    ordersRepository.createPublicOrder = async () => { throw businessError; };

    const response = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'known-business-error' },
      body: JSON.stringify(validPosOrder),
    });

    assert.equal(response.status, 409);
    assert.equal(businessError.code, 'ORDER_IDEMPOTENCY_CONFLICT');
    assert.equal((await response.json()).error, businessError.message);
  });

  it('masks unexpected repository SQL/provider details in production', async () => {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    ordersRepository.createPublicOrder = async () => {
      throw new Error('SELECT * FROM payments WHERE provider_secret = super-secret');
    };
    try {
      const response = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'unexpected-provider-error' },
        body: JSON.stringify(validPosOrder),
      });
      const body = await response.json();
      assert.equal(response.status, 500);
      assert.equal(body.code, 'INTERNAL_SERVER_ERROR');
      assert.doesNotMatch(JSON.stringify(body), /SELECT|super-secret|provider_secret/i);
    } finally {
      if (previousEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnv;
    }
  });

  it('forwards an async rejection only once when next was already called', async () => {
    let calls = 0;
    const handler = asyncHandler(async (_req, _res, next) => {
      next(new Error('first'));
      throw new Error('second');
    });
    handler({}, {}, () => { calls += 1; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
  });
});

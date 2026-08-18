import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import publicRoutes from '../routes/public.js';
import ordersRepository from '../repositories/postgres/orders.js';
import { claimOrderIdempotency, hashOrderRequest } from '../services/order-idempotency.js';

describe('Public order idempotency conflict contract', () => {
  it('rejects the same key when the canonical request payload differs', async () => {
    let stored = null;
    const tx = {
      async query(sql, params) {
        if (sql.includes('INSERT INTO idempotency_keys')) {
          if (!stored) {
            stored = { scope: params[1], request_hash: params[2], status: 'processing', response_body: null };
            return [[{ id: 1 }], 1];
          }
          return [[], 0];
        }
        if (sql.includes('SELECT scope, request_hash')) return [[stored], 1];
        throw new Error(`Unexpected query: ${sql}`);
      },
    };
    const first = { store_id: 1, items: [{ product_id: 1, qty: 1 }] };
    const changed = { items: [{ qty: 2, product_id: 1 }], store_id: 1 };
    await claimOrderIdempotency(tx, { key: 'same-key', scope: 'online-order:guest:test', requestHash: hashOrderRequest(first) });
    await assert.rejects(
      () => claimOrderIdempotency(tx, { key: 'same-key', scope: 'online-order:guest:test', requestHash: hashOrderRequest(changed) }),
      (error) => error.status === 409,
    );
  });

  it('returns a repository conflict status instead of downgrading it to 400', async () => {
    const originalCreate = ordersRepository.createPublicOrder;
    ordersRepository.createPublicOrder = async () => {
      const error = new Error('Idempotency-Key đã được dùng cho yêu cầu khác');
      error.status = 409;
      throw error;
    };
    const app = express();
    app.use(express.json());
    app.use('/api', publicRoutes);
    const server = http.createServer(app);
    try {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'same-key' },
        body: JSON.stringify({
          source: 'pos', payment_method: 'COD', store_id: 1, customer_name: 'Test', customer_phone: '0900000000',
          items: [{ product_id: 1, qty: 1 }],
        }),
      });
      assert.equal(response.status, 409);
    } finally {
      ordersRepository.createPublicOrder = originalCreate;
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

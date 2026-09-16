import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import paymentsRouter, { handlePayOSWebhook } from '../routes/payments.js';
import { JWT_SECRET } from '../config/env.js';

describe('Sandbox Payment Routes & Neutral API Contract', () => {
  const originalEnv = { ...process.env };
  let app;
  let server;
  let baseUrl;

  function createCustomerToken(userId) {
    return jwt.sign({ id: userId, role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
  }

  beforeEach(async () => {
    process.env.PAYMENT_MODE = 'qa_sandbox';
    app = express();
    app.use(express.json());
    app.use('/api/payments', paymentsRouter);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('returns 404 for sandbox routes when PAYMENT_MODE=payos', async () => {
    process.env.PAYMENT_MODE = 'payos';
    const token = createCustomerToken(1);

    const resSession = await fetch(`${baseUrl}/api/payments/sandbox/session?token=abc`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(resSession.status, 404);

    const resTransfer = await fetch(`${baseUrl}/api/payments/sandbox/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token: 'abc', amount: 50000 }),
    });
    assert.equal(resTransfer.status, 404);
  });

  it('requires customer authentication on sandbox session and transfer endpoints', async () => {
    const resSession = await fetch(`${baseUrl}/api/payments/sandbox/session?token=abc`);
    assert.equal(resSession.status, 401);

    const resTransfer = await fetch(`${baseUrl}/api/payments/sandbox/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'abc', amount: 50000 }),
    });
    assert.equal(resTransfer.status, 401);
  });

  it('safely ignores PayOS webhooks in qa_sandbox mode without mutating targets', async () => {
    process.env.PAYMENT_MODE = 'qa_sandbox';
    const res = await fetch(`${baseUrl}/api/payments/payos/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { orderCode: 999999 } }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.ignored, true);
    assert.equal(body.reason, 'PAYMENT_MODE_SANDBOX');
  });

  it('always returns 404 for simulate-success', async () => {
    const res = await fetch(`${baseUrl}/api/payments/payos/simulate-success`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_code: 'TP123' }),
    });
    assert.equal(res.status, 404);
  });

  it('validates transfer input payload and exact amount requirements', async () => {
    const token = createCustomerToken(1);

    // Missing token
    const resNoToken = await fetch(`${baseUrl}/api/payments/sandbox/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount: 50000 }),
    });
    assert.equal(resNoToken.status, 400);

    // Invalid amount (float near amount)
    const resFloat = await fetch(`${baseUrl}/api/payments/sandbox/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token: 'validtoken', amount: 49999.6 }),
    });
    assert.equal(resFloat.status, 400);
  });
});

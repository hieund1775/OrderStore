import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../app.js';

async function withServer(app, fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('Rate Limiting Tiering & Polling Isolation', () => {
  it('allows high-frequency polling on /api/orders/lookup without triggering 429', async () => {
    const testApp = createApp();
    await withServer(testApp, async (baseUrl) => {
      // Send 35 rapid lookup requests (previously 20 requests was the limit)
      const requests = Array.from({ length: 35 }, async (_, i) => {
        const res = await fetch(`${baseUrl}/api/orders/lookup?code=TP_TEST_LOOKUP`);
        return res.status;
      });

      const statuses = await Promise.all(requests);
      // All statuses should be 404 (or 200/400), but NEVER 429
      for (const status of statuses) {
        assert.notEqual(status, 429, 'Polling /api/orders/lookup must not be throttled to 429');
      }
    });
  });

  it('allows high-frequency polling on /api/payments/payos/status without triggering 429', async () => {
    const testApp = createApp();
    await withServer(testApp, async (baseUrl) => {
      const requests = Array.from({ length: 35 }, async () => {
        const res = await fetch(`${baseUrl}/api/payments/payos/status?code=TP_TEST_PAYOS`);
        return res.status;
      });

      const statuses = await Promise.all(requests);
      for (const status of statuses) {
        assert.notEqual(status, 429, 'Polling /api/payments/payos/status must not be throttled to 429');
      }
    });
  });

  it('returns standard RateLimit headers on polling endpoints', async () => {
    const testApp = createApp();
    await withServer(testApp, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/orders/lookup?code=TP_HEADER_TEST`);
      const limitHeader = res.headers.get('ratelimit-limit');
      assert.ok(limitHeader, 'Should contain RateLimit-Limit header');
      assert.equal(Number(limitHeader), 1200, 'Polling limit should be 1200');
    });
  });
});

import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createPublicPreordersAvailabilityRouter } from '../routes/public/preorders.js';

const servers = [];

async function start(service) {
  const app = express();
  app.use('/api/preorders', createPublicPreordersAvailabilityRouter({ service }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const { port } = server.address();
  return `http://127.0.0.1:${port}/api/preorders`;
}

async function response(url) {
  const result = await fetch(url);
  return { status: result.status, body: await result.json() };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))));
});

describe('GET /api/preorders/availability validation', () => {
  it('rejects a missing store_id before calling the service', async () => {
    let calls = 0;
    const url = await start({ availability: async () => { calls += 1; return {}; } });
    const result = await response(`${url}/availability`);

    assert.equal(result.status, 400);
    assert.equal(calls, 0);
    assert.match(result.body.error, /store_id/i);
    assert.equal(Object.hasOwn(result.body, 'stack'), false);
  });

  it('rejects a malformed store_id before calling the service', async () => {
    let calls = 0;
    const url = await start({ availability: async () => { calls += 1; return {}; } });
    const result = await response(`${url}/availability?store_id=not-a-number&date=2026-09-15`);

    assert.equal(result.status, 400);
    assert.equal(calls, 0);
    assert.match(result.body.error, /store_id/i);
  });

  it('rejects a missing or invalid date before calling the service', async () => {
    let calls = 0;
    const url = await start({ availability: async () => { calls += 1; return {}; } });
    const missing = await response(`${url}/availability?store_id=1`);
    const invalid = await response(`${url}/availability?store_id=1&date=2026-02-30`);

    assert.equal(missing.status, 400);
    assert.equal(invalid.status, 400);
    assert.equal(calls, 0);
    assert.match(missing.body.error, /date/i);
    assert.match(invalid.body.error, /date/i);
  });

  it('preserves the configured-store business error after valid query validation', async () => {
    let call;
    const unavailable = Object.assign(new Error('Preorder store unavailable'), { status: 409, code: 'PREORDER_STORE_UNAVAILABLE' });
    const url = await start({ availability: async (input) => { call = input; throw unavailable; } });
    const result = await response(`${url}/availability?store_id=1&date=2026-09-15`);

    assert.equal(result.status, 409);
    assert.deepEqual(call, { storeId: 1, date: '2026-09-15' });
    assert.equal(result.body.error, 'Preorder store unavailable');
  });

  it('returns public store availability without exposing responsible Manager data', async () => {
    const url = await start({
      availability: async () => ({ slots: [] }),
      listStoreAvailability: async () => [{ store_id: 1, is_available: false }, { store_id: 2, is_available: true }],
    });
    const result = await response(`${url}/stores`);

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { stores: [{ store_id: 1, is_available: false }, { store_id: 2, is_available: true }] });
    assert.equal(JSON.stringify(result.body).includes('manager'), false);
  });
});

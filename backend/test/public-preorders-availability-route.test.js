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

  it('rejects missing or malformed table-availability query values before calling the service', async () => {
    let calls = 0;
    const url = await start({
      availability: async () => ({ slots: [] }),
      availableTables: async () => { calls += 1; return { tables: [] }; },
    });

    const missingStore = await response(`${url}/tables?date=2026-09-15&hour=20`);
    const invalidHour = await response(`${url}/tables?store_id=1&date=2026-09-15&hour=23`);
    const invalidDate = await response(`${url}/tables?store_id=1&date=not-a-date&hour=20`);

    assert.equal(missingStore.status, 400);
    assert.equal(invalidHour.status, 400);
    assert.equal(invalidDate.status, 400);
    assert.equal(calls, 0);
    assert.equal(Object.hasOwn(missingStore.body, 'stack'), false);
  });

  it('returns an empty table list for a valid slot and preserves store-unavailable business errors', async () => {
    const emptyUrl = await start({
      availability: async () => ({ slots: [] }),
      availableTables: async (input) => {
        assert.deepEqual(input, { storeId: 1, date: '2026-09-15', hour: 20 });
        return { scheduled_start_at: '2026-09-15T13:00:00.000Z', tables: [] };
      },
    });
    const empty = await response(`${emptyUrl}/tables?store_id=1&date=2026-09-15&hour=20`);
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.tables, []);

    const unavailable = Object.assign(new Error('Preorder store unavailable'), { status: 409, code: 'PREORDER_STORE_UNAVAILABLE' });
    const unavailableUrl = await start({
      availability: async () => ({ slots: [] }),
      availableTables: async () => { throw unavailable; },
    });
    const result = await response(`${unavailableUrl}/tables?store_id=1&date=2026-09-15&hour=20`);
    assert.equal(result.status, 409);
    assert.equal(result.body.error, 'Preorder store unavailable');
  });
});

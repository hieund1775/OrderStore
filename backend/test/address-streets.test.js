import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { createAddressRepository } from '../repositories/postgres/address.js';
import publicAddressRouter, { createPublicAddressRouter } from '../routes/public/address.js';

describe('Vietnam Address Streets Repository & API Suite', () => {
  it('searchStreets builds correct SQL and parameters with province, district, and query', async () => {
    let capturedSql = '';
    let capturedParams = [];

    const mockDb = {
      async query(sql, params) {
        capturedSql = sql;
        capturedParams = params;
        return [[
          { street_name: 'Lê Lợi' },
          { street_name: 'Lê Lai' },
        ]];
      },
    };

    const repo = createAddressRepository(mockDb);
    const results = await repo.searchStreets({
      province: 'Thành phố Hồ Chí Minh',
      district: 'Quận 1',
      query: 'Lê',
      limit: 10,
    });

    assert.deepEqual(results, ['Lê Lợi', 'Lê Lai']);
    assert.ok(capturedSql.includes('FROM vietnam_streets'));
    assert.ok(capturedSql.includes('province_name ILIKE'));
    assert.ok(capturedSql.includes('district_name ILIKE'));
    assert.ok(capturedSql.includes('street_name ILIKE'));
    // Checks that prefixes 'Thành phố' and 'Quận' were cleaned
    assert.ok(capturedParams.includes('%Hồ Chí Minh%'));
    assert.ok(capturedParams.includes('%1%'));
    assert.ok(capturedParams.includes('%Lê%'));
  });

  it('searchStreets returns empty array immediately if query is less than 2 characters', async () => {
    let queryExecuted = false;
    const mockDb = {
      async query() {
        queryExecuted = true;
        return [[]];
      },
    };

    const repo = createAddressRepository(mockDb);
    const results = await repo.searchStreets({ query: 'a' });
    assert.deepEqual(results, []);
    assert.equal(queryExecuted, false);
  });

  it('insertStreetsBatch handles chunking and conflict resolution', async () => {
    const executedQueries = [];
    const mockDb = {
      async query(sql, params) {
        executedQueries.push({ sql, count: params.length / 3 });
        return [null, params.length / 3];
      },
    };

    const repo = createAddressRepository(mockDb);
    const sample = [
      { province_name: 'Hồ Chí Minh', district_name: 'Quận 1', street_name: 'Nguyễn Huệ' },
      { province_name: 'Hồ Chí Minh', district_name: 'Quận 1', street_name: 'Lê Lợi' },
    ];

    const inserted = await repo.insertStreetsBatch(sample);
    assert.equal(inserted, 2);
    assert.equal(executedQueries.length, 1);
    assert.ok(executedQueries[0].sql.includes('ON CONFLICT (province_name, district_name, street_name) DO NOTHING'));
  });

  it('GET /api/address/streets route returns 200 with matching streets', async () => {
    const mockRepo = {
      async searchStreets({ query }) {
        if (query === 'ng') return ['Nguyễn Huệ', 'Nguyễn Trãi'];
        return [];
      },
    };

    const app = express();
    app.use('/api/address', createPublicAddressRouter(mockRepo));
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/address/streets?q=ng&limit=5`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.deepEqual(data, ['Nguyễn Huệ', 'Nguyễn Trãi']);
    } finally {
      server.close();
    }
  });
});

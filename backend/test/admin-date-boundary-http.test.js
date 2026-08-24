import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSingleDateBoundary, parseDateRangeBoundaries } from '../services/date-range.js';
import { createAdminReportsRepository } from '../repositories/postgres/admin-reports.js';

describe('Admin Orders & Reports Vietnam Date Boundaries', () => {
  it('maps inclusive Vietnam calendar dates to half-open UTC filters', () => {
    const range = parseDateRangeBoundaries('2026-08-20', '2026-08-25');
    assert.equal(range.start, '2026-08-19T17:00:00.000Z');
    assert.equal(range.end, '2026-08-25T17:00:00.000Z');
  });

  it('handles single date_from and date_to correctly', async () => {
    const rangeFrom = parseSingleDateBoundary('2026-08-25');
    assert.equal(rangeFrom.start, '2026-08-24T17:00:00.000Z');
    assert.equal(rangeFrom.end, '2026-08-25T17:00:00.000Z');
  });

  it('uses one injected instant for dashboard today and yesterday queries', async () => {
    const queries = [];
    const database = {
      async query(sql, params) {
        queries.push({ sql, params });
        if (sql.includes('COUNT(*)::int AS total')) return [[{ total: 0, avg: 0 }], 1];
        return [[{ v: 0 }], 1];
      },
    };
    const repository = createAdminReportsRepository(database, {
      clock: () => new Date('2026-08-24T17:05:00.000Z'),
    });

    await repository.getKPI({ scopedStoreId: 9 });

    assert.deepEqual(queries[0].params, ['2026-08-24T17:00:00.000Z', '2026-08-25T17:00:00.000Z', 9]);
    assert.deepEqual(queries[1].params, ['2026-08-23T17:00:00.000Z', '2026-08-24T17:00:00.000Z', 9]);
    for (const query of queries) {
      assert.equal(query.sql.includes('CURRENT_DATE'), false);
    }
  });

  it('applies report range parameters inside the revenue-by-branch LEFT JOIN', async () => {
    let captured = null;
    const repository = createAdminReportsRepository({
      async query(sql, params) {
        captured = { sql, params };
        return [[], 0];
      },
    });

    await repository.getRevenueByBranch({
      dateFrom: '2026-08-19T17:00:00.000Z',
      dateTo: '2026-08-25T17:00:00.000Z',
    });

    assert.match(captured.sql, /LEFT JOIN orders o ON[\s\S]*o\.created_at >= \$1/);
    assert.match(captured.sql, /o\.created_at < \$2/);
    assert.deepEqual(captured.params, ['2026-08-19T17:00:00.000Z', '2026-08-25T17:00:00.000Z']);
  });
});

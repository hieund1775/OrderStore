import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePage,
  validateLimit,
  isPaginationRequested,
  buildOffsetPagination,
  PaginationValidationError,
} from '../services/offset-pagination.js';

describe('Offset Pagination Service Contract Tests', () => {
  describe('validatePage', () => {
    it('returns default page when undefined or null or empty', () => {
      assert.equal(validatePage(undefined), 1);
      assert.equal(validatePage(null), 1);
      assert.equal(validatePage(''), 1);
      assert.equal(validatePage(undefined, 2), 2);
    });

    it('parses valid integer strings', () => {
      assert.equal(validatePage('1'), 1);
      assert.equal(validatePage('5'), 5);
      assert.equal(validatePage(10), 10);
    });

    it('rejects 0, negative numbers, floats, and non-numeric strings with 400', () => {
      assert.throws(() => validatePage('0'), (err) => err instanceof PaginationValidationError && err.status === 400);
      assert.throws(() => validatePage('-1'), (err) => err instanceof PaginationValidationError && err.status === 400);
      assert.throws(() => validatePage('1.5'), (err) => err instanceof PaginationValidationError && err.status === 400);
      assert.throws(() => validatePage('abc'), (err) => err instanceof PaginationValidationError && err.status === 400);
    });
  });

  describe('validateLimit', () => {
    it('returns default limit when undefined or null or empty', () => {
      assert.equal(validateLimit(undefined, 5, 50), 5);
      assert.equal(validateLimit(null, 6, 50), 6);
      assert.equal(validateLimit('', 10, 50), 10);
    });

    it('parses valid limit', () => {
      assert.equal(validateLimit('5', 5, 50), 5);
      assert.equal(validateLimit('10', 5, 50), 10);
    });

    it('clamps limit to maxLimit', () => {
      assert.equal(validateLimit('100', 5, 50), 50);
      assert.equal(validateLimit(60, 6, 50), 50);
    });

    it('rejects 0, negative numbers, floats, and non-numeric strings with 400', () => {
      assert.throws(() => validateLimit('0'), (err) => err instanceof PaginationValidationError && err.status === 400);
      assert.throws(() => validateLimit('-5'), (err) => err instanceof PaginationValidationError && err.status === 400);
      assert.throws(() => validateLimit('2.5'), (err) => err instanceof PaginationValidationError && err.status === 400);
      assert.throws(() => validateLimit('xyz'), (err) => err instanceof PaginationValidationError && err.status === 400);
    });
  });

  describe('isPaginationRequested', () => {
    it('returns true if page or limit is present', () => {
      assert.equal(isPaginationRequested({ page: '1' }), true);
      assert.equal(isPaginationRequested({ limit: '5' }), true);
      assert.equal(isPaginationRequested({ page: '1', limit: '10' }), true);
    });

    it('returns false if neither page nor limit is present', () => {
      assert.equal(isPaginationRequested({}), false);
      assert.equal(isPaginationRequested({ view: 'pending' }), false);
      assert.equal(isPaginationRequested(undefined), false);
    });
  });

  describe('buildOffsetPagination', () => {
    it('builds standard metadata for positive counts', () => {
      const p = buildOffsetPagination({ totalItems: 23, page: 2, limit: 6 });
      assert.deepEqual(p, {
        page: 2,
        limit: 6,
        totalItems: 23,
        totalPages: 4,
      });
    });

    it('handles 0 totalItems gracefully with 0 totalPages', () => {
      const p = buildOffsetPagination({ totalItems: 0, page: 1, limit: 10 });
      assert.deepEqual(p, {
        page: 1,
        limit: 10,
        totalItems: 0,
        totalPages: 0,
      });
    });
  });
});

import express from 'express';
import { createAdminPreordersRouter } from '../routes/admin/preorders.js';
import { createPreordersRepository } from '../repositories/postgres/preorders.js';

describe('Admin Preorders Router Pagination Contract Tests', () => {
  async function startServer(repository, user = { role: 'super', sub: 1 }) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = user;
      next();
    });
    app.use('/admin/preorders', createAdminPreordersRouter({
      repository,
      service: {},
      database: { query: async () => ({ rows: [] }) },
    }));
    const server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    return {
      baseUrl: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((resolve) => server.close(resolve)),
    };
  }

  it('returns bare array when pagination is not requested (legacy compatibility)', async () => {
    const mockItems = [{ id: 1, preorder_code: 'PRE-1' }, { id: 2, preorder_code: 'PRE-2' }];
    const repository = {
      async list(opts) {
        assert.equal(opts.page, undefined);
        assert.equal(opts.limit, undefined);
        return mockItems;
      },
    };
    const fixture = await startServer(repository);
    try {
      const res = await fetch(`${fixture.baseUrl}/admin/preorders?view=pending`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data));
      assert.deepEqual(data, mockItems);
    } finally {
      await fixture.close();
    }
  });

  it('returns { items, pagination } when page and limit are requested', async () => {
    const mockItems = [{ id: 1, preorder_code: 'PRE-1' }];
    const repository = {
      async list(opts) {
        assert.equal(opts.page, 1);
        assert.equal(opts.limit, 6);
        return { items: mockItems, totalItems: 15 };
      },
    };
    const fixture = await startServer(repository);
    try {
      const res = await fetch(`${fixture.baseUrl}/admin/preorders?view=pending&page=1&limit=6`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.deepEqual(data, {
        items: mockItems,
        pagination: {
          page: 1,
          limit: 6,
          totalItems: 15,
          totalPages: 3,
        },
      });
    } finally {
      await fixture.close();
    }
  });

  it('rejects invalid page with 400', async () => {
    const fixture = await startServer({});
    try {
      const res = await fetch(`${fixture.baseUrl}/admin/preorders?page=0&limit=6`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Số trang (page) phải là số nguyên dương'));
    } finally {
      await fixture.close();
    }
  });

  it('rejects invalid limit with 400', async () => {
    const fixture = await startServer({});
    try {
      const res = await fetch(`${fixture.baseUrl}/admin/preorders?page=1&limit=-1`);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Giới hạn số lượng (limit) phải là số nguyên dương'));
    } finally {
      await fixture.close();
    }
  });

  describe('Kitchen Confirmed Preorder Preview', () => {
    it('supports bounded read query with limit=6, calls repository with page=1, limit=6, and unwraps { items } to bare array', async () => {
      const mockConfirmed = [
        { id: 101, preorder_code: 'PRE-CONF-1', scheduled_start_at: '2026-09-15T12:30:00.000Z' },
        { id: 102, preorder_code: 'PRE-CONF-2', scheduled_start_at: '2026-09-15T13:00:00.000Z' },
      ];
      let capturedOpts = null;
      const repository = {
        async list(opts) {
          capturedOpts = opts;
          return { items: mockConfirmed, totalItems: 2 };
        },
      };
      const fixture = await startServer(repository);
      try {
        const res = await fetch(`${fixture.baseUrl}/admin/preorders/kitchen/confirmed?limit=6`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(Array.isArray(data));
        assert.deepEqual(data, mockConfirmed);
        assert.equal(capturedOpts.page, 1);
        assert.equal(capturedOpts.limit, 6);
        assert.equal(capturedOpts.status, 'CONFIRMED');
        assert.equal(capturedOpts.kitchenUpcomingOnly, true);
        assert.equal(capturedOpts.orderBy, 'active');
      } finally {
        await fixture.close();
      }
    });

    it('preserves legacy unpaginated bare array when limit query is omitted', async () => {
      const mockAllConfirmed = [
        { id: 101, preorder_code: 'PRE-CONF-1' },
        { id: 102, preorder_code: 'PRE-CONF-2' },
        { id: 103, preorder_code: 'PRE-CONF-3' },
      ];
      let capturedOpts = null;
      const repository = {
        async list(opts) {
          capturedOpts = opts;
          return mockAllConfirmed;
        },
      };
      const fixture = await startServer(repository);
      try {
        const res = await fetch(`${fixture.baseUrl}/admin/preorders/kitchen/confirmed`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(Array.isArray(data));
        assert.deepEqual(data, mockAllConfirmed);
        assert.equal(capturedOpts.page, undefined);
        assert.equal(capturedOpts.limit, undefined);
        assert.equal(capturedOpts.status, 'CONFIRMED');
        assert.equal(capturedOpts.kitchenUpcomingOnly, true);
        assert.equal(capturedOpts.orderBy, 'active');
      } finally {
        await fixture.close();
      }
    });

    it('rejects invalid limit with 400', async () => {
      const fixture = await startServer({});
      try {
        const res = await fetch(`${fixture.baseUrl}/admin/preorders/kitchen/confirmed?limit=abc`);
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.ok(data.error.includes('Giới hạn số lượng (limit) phải là số nguyên dương'));
      } finally {
        await fixture.close();
      }
    });

    it('authorizes role: packing and forwards lane=packing to repository.list', async () => {
      let capturedOpts = null;
      const repository = {
        async list(opts) {
          capturedOpts = opts;
          return [{ id: 99, preorder_code: 'PRE-PACKING-1' }];
        },
      };
      const fixture = await startServer(repository, { role: 'packing', sub: 25, branch_id: 1 });
      try {
        const res = await fetch(`${fixture.baseUrl}/admin/preorders/kitchen/confirmed?lane=packing&limit=6`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data[0].preorder_code, 'PRE-PACKING-1');
        assert.equal(capturedOpts.lane, 'packing');
        assert.equal(capturedOpts.status, 'CONFIRMED');
        assert.equal(capturedOpts.kitchenUpcomingOnly, true);
      } finally {
        await fixture.close();
      }
    });

    it('end-to-end proves limit=6 executes SQL LIMIT 6, no limit omits LIMIT, and order is scheduled_start_at ASC, id ASC', async () => {
      let capturedSql = '';
      let capturedParams = [];
      const db = {
        async query(sql, params) {
          if (sql.includes("to_regclass('preorder_checkin_requests')")) return { rows: [{ available: false }] };
          if (sql.includes('FROM preorders p')) {
            capturedSql = sql;
            capturedParams = params;
            return {
              rows: [
                { id: 1, scheduled_start_at: '2026-09-15T12:00:00.000Z', store_name: 'S1', customer_name: 'C1', total_count: 1 },
              ],
            };
          }
          return { rows: [] };
        },
      };
      const realRepo = createPreordersRepository(db);
      const fixture = await startServer(realRepo);
      try {
        const res = await fetch(`${fixture.baseUrl}/admin/preorders/kitchen/confirmed?limit=6`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(Array.isArray(data));
        assert.equal(data.length, 1);
        assert.match(capturedSql, /LIMIT \$\d+/);
        assert.equal(capturedParams[capturedParams.length - 2], 6); // LIMIT 6
        assert.match(capturedSql, /ORDER BY p\.scheduled_start_at ASC, p\.id ASC/);

        // Test without limit
        capturedSql = '';
        const resLegacy = await fetch(`${fixture.baseUrl}/admin/preorders/kitchen/confirmed`);
        assert.equal(resLegacy.status, 200);
        const dataLegacy = await resLegacy.json();
        assert.ok(Array.isArray(dataLegacy));
        assert.equal(capturedSql.includes('LIMIT'), false);
        assert.match(capturedSql, /ORDER BY p\.scheduled_start_at ASC, p\.id ASC/);
      } finally {
        await fixture.close();
      }
    });
  });
});

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

describe('Admin Preorders Router Pagination Contract Tests', () => {
  async function startServer(repository) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { role: 'super', sub: 1 };
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
});


import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAdminStoresRepository, AdminStoreError } from '../repositories/postgres/admin-stores.js';

describe('Admin Stores Cascade Delete Unit Suite', () => {
  it('executes cascade cleanup queries for promotion_stores, job_stores, ingredients, tables before deleting store', async () => {
    const executedQueries = [];

    const mockDb = {
      async query(sql, params) {
        executedQueries.push({ sql, params });
        if (sql.includes('SELECT id, name FROM stores')) {
          return [[{ id: 99, name: 'Chi nhánh Test Xóa' }]];
        }
        if (sql.includes('SELECT COUNT(*)::int AS c FROM orders')) {
          return [[{ c: 0 }]];
        }
        return [[], 1];
      },
      async transaction(cb) {
        const mockTx = {
          async query(sql, params) {
            executedQueries.push({ sql, params });
            return [[], 1];
          },
        };
        return cb(mockTx);
      },
    };

    const repo = createAdminStoresRepository(mockDb);
    const result = await repo.deleteBranch(99);
    assert.equal(result, true);

    const sqlStrings = executedQueries.map((q) => q.sql);
    assert.equal(sqlStrings.some((s) => s.includes('DELETE FROM promotion_stores WHERE store_id = $1')), true);
    assert.equal(sqlStrings.some((s) => s.includes('DELETE FROM job_stores WHERE store_id = $1')), true);
    assert.equal(sqlStrings.some((s) => s.includes('UPDATE job_applications SET store_id = NULL WHERE store_id = $1')), true);
    assert.equal(sqlStrings.some((s) => s.includes('UPDATE users SET admin_branch_id = NULL WHERE admin_branch_id = $1')), true);
    assert.equal(sqlStrings.some((s) => s.includes('DELETE FROM ingredients WHERE store_id = $1')), true);
    assert.equal(sqlStrings.some((s) => s.includes('DELETE FROM tables WHERE store_id = $1')), true);
    assert.equal(sqlStrings.some((s) => s.includes('DELETE FROM stores WHERE id = $1')), true);
  });

  it('rejects deletion when store has existing orders to preserve business history', async () => {
    const mockDb = {
      async query(sql) {
        if (sql.includes('SELECT id, name FROM stores')) {
          return [[{ id: 1, name: 'Chi nhánh Nguyễn Huệ' }]];
        }
        if (sql.includes('SELECT COUNT(*)::int AS c FROM orders')) {
          return [[{ c: 15 }]];
        }
        return [[], 1];
      },
    };

    const repo = createAdminStoresRepository(mockDb);
    await assert.rejects(
      async () => repo.deleteBranch(1),
      (err) => err instanceof AdminStoreError && err.message.includes('15 đơn hàng')
    );
  });
});

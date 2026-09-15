import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAdminStoresRepository } from '../repositories/postgres/admin-stores.js';
import { createAdminPromotionsRepository } from '../repositories/postgres/admin-promotions.js';
import { createAdminCatalogRepository } from '../repositories/postgres/admin-catalog.js';
import { createBranchOffersRepository } from '../repositories/postgres/branch-offers.js';
import { createNotificationsRepository } from '../repositories/postgres/notifications.js';
import { createPreordersRepository } from '../repositories/postgres/preorders.js';

describe('Canonical Repository SQL-Level Pagination & Deterministic Sorting', () => {
  it('preorders createAwaitingPayment does NOT insert into preorder_table_reservations', async () => {
    const executedSqls = [];
    const mockDb = {
      async query(sql) {
        executedSqls.push(sql);
        return [[{ id: 101, preorder_code: 'PO-TABLE-FREE' }]];
      },
      async transaction(cb) {
        return cb(mockDb);
      },
    };

    const repo = createPreordersRepository(mockDb);
    const preorder = await repo.createAwaitingPayment({
      preorderCode: 'PO-TABLE-FREE',
      storeId: 1,
      customerUserId: 10,
      idempotencyKey: 'idem-table-free',
      scheduledStartAt: new Date(),
      scheduledEndAt: new Date(),
      responsibleManagerId: 5,
    });

    assert.equal(preorder.preorder_code, 'PO-TABLE-FREE');
    const reservationWrite = executedSqls.find((sql) => sql.includes('preorder_table_reservations'));
    assert.equal(reservationWrite, undefined);
  });

  it('admin-stores listBranches applies COUNT(*) OVER(), LIMIT/OFFSET, and ORDER BY s.id DESC in SQL', async () => {
    let capturedSql = '';
    let capturedParams = [];
    const mockDb = {
      async query(sql, params) {
        capturedSql = sql;
        capturedParams = params;
        return [[
          { id: 2, name: 'Chi nhánh 2', total_count: '2' },
          { id: 1, name: 'Chi nhánh 1', total_count: '2' },
        ]];
      },
    };

    const repo = createAdminStoresRepository(mockDb);
    const result = await repo.listBranches({ page: 1, limit: 5 });

    assert.ok(capturedSql.includes('COUNT(*) OVER() AS total_count'), 'SQL must contain COUNT(*) OVER()');
    assert.ok(capturedSql.includes('ORDER BY s.id DESC'), 'SQL must contain deterministic ORDER BY s.id DESC');
    assert.ok(capturedSql.includes('LIMIT $1 OFFSET $2'), 'SQL must contain LIMIT/OFFSET clauses');
    assert.deepEqual(capturedParams, [5, 0]);
    assert.equal(result.totalItems, 2);
    assert.equal(result.items.length, 2);

    // Unpaginated fallback
    capturedSql = '';
    const unpaginated = await repo.listBranches({});
    assert.ok(!capturedSql.includes('LIMIT'), 'Unpaginated query must not contain LIMIT');
    assert.ok(Array.isArray(unpaginated), 'Unpaginated call must return an array');
  });

  it('admin-stores listTables applies COUNT(*) OVER(), LIMIT/OFFSET, and ORDER BY t.store_id ASC, t.id DESC', async () => {
    let capturedSql = '';
    let capturedParams = [];
    const mockDb = {
      async query(sql, params) {
        capturedSql = sql;
        capturedParams = params;
        return [[{ id: 10, store_id: 1, name: 'Bàn 10', total_count: '1' }]];
      },
    };

    const repo = createAdminStoresRepository(mockDb);
    const result = await repo.listTables({ page: 2, limit: 5 });

    assert.ok(capturedSql.includes('COUNT(*) OVER() AS total_count'));
    assert.ok(capturedSql.includes('ORDER BY t.store_id ASC, t.id DESC'));
    assert.ok(capturedSql.includes('LIMIT $1 OFFSET $2'));
    assert.deepEqual(capturedParams, [5, 5]);
    assert.equal(result.totalItems, 1);
  });

  it('admin-promotions listPromotions applies COUNT(*) OVER(), LIMIT/OFFSET, and ORDER BY p.id DESC', async () => {
    let capturedSql = '';
    let capturedParams = [];
    const mockDb = {
      async query(sql, params) {
        capturedSql = sql;
        capturedParams = params;
        return [[{ id: 99, code: 'SUMMER', total_count: '10' }]];
      },
    };

    const repo = createAdminPromotionsRepository(mockDb);
    const result = await repo.listPromotions({ page: 1, limit: 5 });

    assert.ok(capturedSql.includes('COUNT(*) OVER() AS total_count'));
    assert.ok(capturedSql.includes('ORDER BY p.id DESC'));
    assert.ok(capturedSql.includes('LIMIT $1 OFFSET $2'));
    assert.deepEqual(capturedParams, [5, 0]);
    assert.equal(result.totalItems, 10);

    // Unpaginated check
    capturedSql = '';
    const all = await repo.listPromotions({});
    assert.ok(!capturedSql.includes('LIMIT'));
    assert.ok(Array.isArray(all));
  });

  it('admin-catalog listProducts applies COUNT(*) OVER(), LIMIT/OFFSET, and ORDER BY c.sort_order ASC, p.id DESC', async () => {
    let capturedSql = '';
    let capturedParams = [];
    const mockDb = {
      async query(sql, params) {
        capturedSql = sql;
        capturedParams = params;
        return [[{ id: 77, name: 'Trà Oolong', total_count: '1' }]];
      },
    };

    const repo = createAdminCatalogRepository(mockDb);
    const result = await repo.listProducts({ page: 1, limit: 5 });

    assert.ok(capturedSql.includes('COUNT(*) OVER() AS total_count'));
    assert.ok(capturedSql.includes('ORDER BY c.sort_order ASC, p.id DESC'));
    assert.ok(capturedSql.includes('LIMIT $1 OFFSET $2'));
    assert.deepEqual(capturedParams, [5, 0]);
    assert.equal(result.totalItems, 1);

    // Unpaginated check
    capturedSql = '';
    const all = await repo.listProducts({});
    assert.ok(!capturedSql.includes('LIMIT'));
    assert.ok(Array.isArray(all));
  });

  it('branch-offers listBranchOffers applies COUNT(*) OVER(), LIMIT/OFFSET, and ORDER BY p.id DESC, pv.id ASC', async () => {
    let capturedSql = '';
    let capturedParams = [];
    const mockDb = {
      async query(sql, params) {
        capturedSql = sql;
        capturedParams = params;
        return [[{ variant_id: 1, product_id: 5, total_count: '3' }]];
      },
    };

    const repo = createBranchOffersRepository(mockDb);
    const result = await repo.listBranchOffers(1, { page: 1, limit: 5 });

    assert.ok(capturedSql.includes('COUNT(*) OVER() AS total_count'));
    assert.ok(capturedSql.includes('ORDER BY p.id DESC, pv.id ASC'));
    assert.ok(capturedSql.includes('LIMIT $2 OFFSET $3'));
    assert.deepEqual(capturedParams, [1, 5, 0]);
    assert.equal(result.totalItems, 3);

    // Unpaginated check
    capturedSql = '';
    const all = await repo.listBranchOffers(1, {});
    assert.ok(!capturedSql.includes('LIMIT'));
    assert.ok(Array.isArray(all));
  });

  it('notifications listForUser applies COUNT(*) OVER(), LIMIT/OFFSET, and ORDER BY created_at DESC, id DESC', async () => {
    let capturedSql = '';
    let capturedParams = [];
    const mockDb = {
      async query(sql, params) {
        capturedSql = sql;
        capturedParams = params;
        return [[{ id: 1, user_id: 10, title: 'Notif', total_count: '5' }]];
      },
    };

    const repo = createNotificationsRepository(mockDb);
    const result = await repo.listForUser(10, 5, { page: 1, type: 'order' });

    assert.ok(capturedSql.includes('COUNT(*) OVER() AS total_count'));
    assert.ok(capturedSql.includes('ORDER BY created_at DESC, id DESC'));
    assert.ok(capturedSql.includes('LIMIT $3 OFFSET $4'));
    assert.deepEqual(capturedParams, [10, 'order', 5, 0]);
    assert.equal(result.totalItems, 5);

    // Unpaginated check
    capturedSql = '';
    const all = await repo.listForUser(10, 50);
    assert.ok(capturedSql.includes('LIMIT $2'));
    assert.ok(!capturedSql.includes('OFFSET'));
    assert.ok(Array.isArray(all));
  });
});

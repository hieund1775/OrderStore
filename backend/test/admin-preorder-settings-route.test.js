import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createAdminPreordersRouter } from '../routes/admin/preorders.js';
import { createPreordersRepository } from '../repositories/postgres/preorders.js';

async function start(user, repository) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = user; next(); });
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

test('Super can read active-store preorder settings with only same-branch active Managers', async () => {
  let calls = 0;
  const stores = [{
    store_id: 2,
    store_name: 'Branch 2',
    is_enabled: false,
    responsible_manager_id: null,
    eligible_managers: [{ id: 12, fullname: 'Manager Branch 2' }],
  }];
  const repository = {
    async listStoreSettingsForSuper() {
      calls += 1;
      return stores;
    },
  };
  const fixture = await start({ role: 'super', sub: 1 }, repository);
  try {
    const response = await fetch(`${fixture.baseUrl}/admin/preorders/settings`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { stores });
    assert.equal(calls, 1);
  } finally { await fixture.close(); }
});

test('Manager cannot read or mutate preorder store settings', async () => {
  let reads = 0;
  let writes = 0;
  const fixture = await start({ role: 'manager', sub: 2, branch_id: 2 }, {
    async listStoreSettingsForSuper() { reads += 1; return []; },
    async setStoreSetting() { writes += 1; return {}; },
  });
  try {
    const read = await fetch(`${fixture.baseUrl}/admin/preorders/settings`);
    assert.equal(read.status, 403);
    const write = await fetch(`${fixture.baseUrl}/admin/preorders/settings/2`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_enabled: true, responsible_manager_id: 12 }),
    });
    assert.equal(write.status, 403);
    assert.equal(reads, 0);
    assert.equal(writes, 0);
  } finally { await fixture.close(); }
});

test('Super cannot enable preorder without selecting a responsible Manager', async () => {
  let writes = 0;
  const fixture = await start({ role: 'super', sub: 1 }, {
    async listStoreSettingsForSuper() { return []; },
    async setStoreSetting() { writes += 1; return {}; },
  });
  try {
    const response = await fetch(`${fixture.baseUrl}/admin/preorders/settings/2`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_enabled: true }),
    });
    assert.equal(response.status, 400);
    assert.equal(writes, 0);
  } finally { await fixture.close(); }
});

test('Settings read model limits eligible Managers to active Managers of the same store branch', async () => {
  let statement = '';
  const repository = createPreordersRepository({
    async query(sql) {
      statement = sql;
      return { rows: [{ store_id: 2, eligible_managers: [{ id: 12, fullname: 'Manager Branch 2' }] }] };
    },
  });
  const rows = await repository.listStoreSettingsForSuper();
  assert.deepEqual(rows[0].eligible_managers, [{ id: 12, fullname: 'Manager Branch 2' }]);
  assert.match(statement, /u\.admin_role = 'manager'/);
  assert.match(statement, /u\.admin_branch_id = s\.id/);
  assert.match(statement, /u\.is_active = TRUE/);
  assert.doesNotMatch(statement, /u\.email/);
});

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { JWT_SECRET } from '../config/env.js';
import storesRepository from '../repositories/postgres/stores.js';
import promotionsRepository from '../repositories/postgres/promotions.js';
import adminStoresRepository from '../repositories/postgres/admin-stores.js';
import adminPromotionsRepository from '../repositories/postgres/admin-promotions.js';
import adminInventoryRepository from '../repositories/postgres/admin-inventory.js';

const superToken = jwt.sign({ sub: 1, role: 'super' }, JWT_SECRET);
const cashierToken = jwt.sign({ sub: 2, role: 'cashier', branch_id: 1 }, JWT_SECRET);

describe('Phase 3 Slice 3 Stores, Promotions & Inventory HTTP Characterization', () => {
  let server;
  let baseUrl;
  let originals;

  before(async () => {
    originals = {
      listActiveStores: storesRepository.listActiveStores,
      listActiveDistricts: storesRepository.listActiveDistricts,
      resolveTable: storesRepository.resolveTable,
      listActivePromotions: promotionsRepository.listActivePromotions,
      preview: promotionsRepository.preview,
      listBranches: adminStoresRepository.listBranches,
      listTables: adminStoresRepository.listTables,
      listPromotions: adminPromotionsRepository.listPromotions,
      listInventory: adminInventoryRepository.listInventory,
    };

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    Object.assign(storesRepository, {
      listActiveStores: originals.listActiveStores,
      listActiveDistricts: originals.listActiveDistricts,
      resolveTable: originals.resolveTable,
    });
    Object.assign(promotionsRepository, {
      listActivePromotions: originals.listActivePromotions,
      preview: originals.preview,
    });
    Object.assign(adminStoresRepository, {
      listBranches: originals.listBranches,
      listTables: originals.listTables,
    });
    Object.assign(adminPromotionsRepository, {
      listPromotions: originals.listPromotions,
    });
    Object.assign(adminInventoryRepository, {
      listInventory: originals.listInventory,
    });
    await new Promise((resolve) => server.close(resolve));
  });

  it('serves public stores, districts, table resolve, and promotions preview', async () => {
    storesRepository.listActiveStores = async () => [
      { id: 1, name: 'Chi nhánh Quận 1', city: 'TP.HCM', district: 'Quận 1', address: '123 Lê Lợi', phone: '0901234567' },
    ];
    storesRepository.listActiveDistricts = async () => [
      { city: 'TP.HCM', district: 'Quận 1' },
    ];
    storesRepository.resolveTable = async (id) => {
      if (id === '1') return { id: 1, store_id: 1, name: 'Bàn 01', store_name: 'Chi nhánh Quận 1' };
      return null;
    };
    promotionsRepository.listActivePromotions = async () => [
      { id: 1, title: 'Giảm 20k', code: 'GIAM20K', discount_type: 'fixed', discount_value: 20000 },
    ];
    promotionsRepository.preview = async ({ code }) => {
      if (code === 'GIAM20K') return { discount_amount: 20000 };
      throw new Error('Mã giảm giá không hợp lệ');
    };

    const storesRes = await fetch(`${baseUrl}/api/stores`);
    assert.equal(storesRes.status, 200);
    const stores = await storesRes.json();
    assert.equal(stores[0].name, 'Chi nhánh Quận 1');

    const districtsRes = await fetch(`${baseUrl}/api/stores/districts`);
    assert.equal(districtsRes.status, 200);

    const tableRes = await fetch(`${baseUrl}/api/table/resolve?table_id=1`);
    assert.equal(tableRes.status, 200);
    const tableData = await tableRes.json();
    assert.equal(tableData.table.name, 'Bàn 01');

    const tableNotFound = await fetch(`${baseUrl}/api/table/resolve?table_id=999`);
    assert.equal(tableNotFound.status, 404);

    const promoRes = await fetch(`${baseUrl}/api/promotions`);
    assert.equal(promoRes.status, 200);

    const voucherValid = await fetch(`${baseUrl}/api/vouchers/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'GIAM20K', subtotal: 100000, store_id: 1 }),
    });
    assert.equal(voucherValid.status, 200);
    assert.equal((await voucherValid.json()).discount_amount, 20000);

    const voucherInvalid = await fetch(`${baseUrl}/api/vouchers/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'INVALID', subtotal: 100000, store_id: 1 }),
    });
    assert.equal(voucherInvalid.status, 400);
  });

  it('serves admin branches, tables, promotions, and inventory with role enforcement', async () => {
    adminStoresRepository.listBranches = async () => [{ id: 1, name: 'Store 1' }];
    adminStoresRepository.listTables = async () => [{ id: 1, store_id: 1, name: 'Bàn 1' }];
    adminPromotionsRepository.listPromotions = async () => [{ id: 1, title: 'Summer' }];
    adminInventoryRepository.listInventory = async () => [{ id: 1, name: 'Trà ô long' }];

    const branchesRes = await fetch(`${baseUrl}/admin/branches`, {
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    assert.equal(branchesRes.status, 200);

    const tablesRes = await fetch(`${baseUrl}/admin/tables`, {
      headers: { authorization: `Bearer ${cashierToken}` },
    });
    assert.equal(tablesRes.status, 200);

    const promosRes = await fetch(`${baseUrl}/admin/promotions`, {
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(promosRes.status, 200);

    const invRes = await fetch(`${baseUrl}/admin/inventory`, {
      headers: { authorization: `Bearer ${superToken}` },
    });
    assert.equal(invRes.status, 200);
  });
});

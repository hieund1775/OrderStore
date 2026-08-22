import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { JWT_SECRET } from '../config/env.js';
import adminCatalogRepository from '../repositories/postgres/admin-catalog.js';

describe('Admin Menu Options HTTP Contract', () => {
  let server;
  let baseUrl;
  let originalListOptions;

  const adminToken = jwt.sign({ sub: 1, role: 'super' }, JWT_SECRET);

  before(async () => {
    originalListOptions = adminCatalogRepository.listOptions;
    adminCatalogRepository.listOptions = async () => ({
      sizes: [{ id: 1, label: 'M', name: 'Size M', price_extra: 0 }],
      bases: [{ id: 1, name: 'Lục Trà Lài' }],
      sugars: [{ id: 1, label: '100% Đường' }],
      ices: [{ id: 1, label: '100% Đá' }],
      toppings: [{ id: 1, name: 'Trân châu đen', price: 5000 }],
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    adminCatalogRepository.listOptions = originalListOptions;
    await new Promise((resolve) => server.close(resolve));
  });

  it('serves GET /admin/menu/options successfully with status 200 and option fields', async () => {
    const res = await fetch(`${baseUrl}/admin/menu/options`, {
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(Array.isArray(body.sizes), true);
    assert.equal(Array.isArray(body.bases), true);
    assert.equal(Array.isArray(body.sugars), true);
    assert.equal(Array.isArray(body.ices), true);
    assert.equal(Array.isArray(body.toppings), true);
    assert.equal(body.sizes[0].label, 'M');
    assert.equal(body.bases[0].name, 'Lục Trà Lài');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/admin/menu/options`);
    assert.equal(res.status, 401);
  });
});

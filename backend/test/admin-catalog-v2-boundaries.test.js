import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { signToken } from '../middleware/auth.js';
import adminCatalogV2Router from '../routes/admin/catalog-v2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(backendDir, relPath), 'utf8');
}

describe('Admin Catalog V2 Architecture & RBAC Boundaries', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    app.use(express.json());

    // Mock authentication middleware based on bearer role claims
    app.use((req, res, next) => {
      const header = req.headers.authorization;
      if (header?.includes('role_super')) {
        req.user = { sub: 1, role: 'super' };
      } else if (header?.includes('role_manager')) {
        req.user = { sub: 2, role: 'manager', branch_id: 1 };
      } else if (header?.includes('role_cashier')) {
        req.user = { sub: 3, role: 'cashier', branch_id: 1 };
      }
      next();
    });

    app.use('/admin/catalog', adminCatalogV2Router);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('verifies catalog-v2 routes do not import database adapters directly', () => {
    const content = readFile('routes/admin/catalog-v2.js');
    const forbiddenDbPatterns = [/config\/db/, /db-postgres/, /postgresDb/, /['"]\.\.\/\.\.\/config\/db/i];

    for (const pattern of forbiddenDbPatterns) {
      assert.equal(
        pattern.test(content),
        false,
        `File routes/admin/catalog-v2.js must not directly import or access database configuration (${pattern})`,
      );
    }
  });

  it('verifies catalog-v2 repositories do not import Express or auth middleware', () => {
    const content = readFile('repositories/postgres/admin-catalog-v2.js');
    const forbidden = [/from\s+['"]express['"]/i, /requireRole/i, /authenticate/i];

    for (const pattern of forbidden) {
      assert.equal(
        pattern.test(content),
        false,
        `File repositories/postgres/admin-catalog-v2.js must not import Express or auth middleware (${pattern})`,
      );
    }
  });

  it('verifies Manager has read-only access to categories, but mutations are rejected with 403', async () => {
    // 1. Manager POST -> 403 Forbidden
    const postRes = await fetch(`${baseUrl}/admin/catalog/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer role_manager',
      },
      body: JSON.stringify({ name: 'Áo Nam', slug: 'ao-nam' }),
    });
    assert.equal(postRes.status, 403);

    // 2. Cashier GET -> 403 Forbidden
    const cashierRes = await fetch(`${baseUrl}/admin/catalog/categories`, {
      method: 'GET',
      headers: { Authorization: 'Bearer role_cashier' },
    });
    assert.equal(cashierRes.status, 403);
  });
});

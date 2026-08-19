import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(backendDir, relPath), 'utf8');
}

describe('Phase 3 architecture boundary & static verification', () => {
  it('verifies domain route files do not import database adapters directly', () => {
    const routeFiles = [
      'routes/admin/orders.js',
      'routes/admin/kitchen.js',
      'routes/public/orders.js',
    ];

    const forbiddenDbPatterns = [
      /config\/db/,
      /db-postgres/,
      /postgresDb/,
      /msnodesqlv8/,
      /['"]\.\.\/\.\.\/config\/db/i,
    ];

    for (const file of routeFiles) {
      const content = readFile(file);
      for (const pattern of forbiddenDbPatterns) {
        assert.equal(
          pattern.test(content),
          false,
          `File ${file} must not directly import or access database configuration (${pattern})`,
        );
      }
    }
  });

  it('verifies repository modules do not import Express or auth middleware', () => {
    const repoFiles = [
      'repositories/orders.js',
      'repositories/postgres/orders.js',
      'repositories/postgres/admin-orders.js',
    ];

    const forbiddenExpressPatterns = [
      /from\s+['"]express['"]/i,
      /middleware\/auth/i,
      /requireRole/i,
      /requireCustomerSelf/i,
    ];

    for (const file of repoFiles) {
      const content = readFile(file);
      for (const pattern of forbiddenExpressPatterns) {
        assert.equal(
          pattern.test(content),
          false,
          `Repository ${file} must not depend on Express or auth middleware (${pattern})`,
        );
      }
    }
  });

  it('verifies order services do not import Express or receive req/res objects', () => {
    const serviceFiles = [
      'services/orders/admin-order-service.js',
      'services/orders/customer-order-service.js',
    ];

    for (const file of serviceFiles) {
      const content = readFile(file);
      assert.equal(
        /from\s+['"]express['"]/i.test(content),
        false,
        `Service ${file} must not import Express`,
      );
      assert.equal(
        /\breq\./i.test(content),
        false,
        `Service ${file} must not use Express req object directly`,
      );
      assert.equal(
        /\bres\./i.test(content),
        false,
        `Service ${file} must not use Express res object directly`,
      );
    }
  });

  it('verifies legacy routers do not define duplicate order or kitchen handlers', () => {
    const adminRoutes = readFile('routes/admin.js');
    const publicRoutes = readFile('routes/public.js');

    // In admin.js, /orders and /kitchen should be mounted as sub-routers, not standalone inline handlers
    assert.equal(/router\.get\(\s*['"]\/orders['"]/i.test(adminRoutes), false);
    assert.equal(/router\.get\(\s*['"]\/orders\/:id['"]/i.test(adminRoutes), false);
    assert.equal(/router\.put\(\s*['"]\/orders\/:id\/status['"]/i.test(adminRoutes), false);
    assert.equal(/router\.put\(\s*['"]\/orders\/:id\/cancel['"]/i.test(adminRoutes), false);
    assert.equal(/router\.put\(\s*['"]\/orders\/:id\/payment\/confirm['"]/i.test(adminRoutes), false);
    assert.equal(/router\.post\(\s*['"]\/orders\/:id\/print['"]/i.test(adminRoutes), false);
    assert.equal(/router\.get\(\s*['"]\/kitchen\/orders['"]/i.test(adminRoutes), false);

    // In public.js, /orders/lookup, /orders/:id/cancel, /orders should be mounted via router.use('/orders', ...)
    assert.equal(/router\.get\(\s*['"]\/orders\/lookup['"]/i.test(publicRoutes), false);
    assert.equal(/router\.post\(\s*['"]\/orders\/:id\/cancel['"]/i.test(publicRoutes), false);
    assert.equal(/router\.post\(\s*['"]\/orders\/cancel['"]/i.test(publicRoutes), false);
    assert.equal(/router\.post\(\s*['"]\/orders['"]/i.test(publicRoutes), false);
  });
});

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

describe('Phase 3 Slice 3 Stores, Promotions & Inventory architecture boundaries', () => {
  it('verifies domain route files do not import database adapters directly', () => {
    const routeFiles = [
      'routes/admin/stores.js',
      'routes/admin/promotions.js',
      'routes/admin/inventory.js',
      'routes/public/stores.js',
      'routes/public/promotions.js',
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
      'repositories/stores.js',
      'repositories/postgres/stores.js',
      'repositories/postgres/admin-stores.js',
      'repositories/promotions.js',
      'repositories/postgres/promotions.js',
      'repositories/postgres/admin-promotions.js',
      'repositories/inventory.js',
      'repositories/postgres/admin-inventory.js',
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

  it('verifies services do not import Express or receive req/res objects', () => {
    const serviceFiles = [
      'services/stores/store-service.js',
      'services/stores/admin-store-service.js',
      'services/promotions/promotion-service.js',
      'services/promotions/admin-promotion-service.js',
      'services/inventory/admin-inventory-service.js',
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

  it('verifies legacy routers do not define duplicate stores, promotions, inventory, or table handlers', () => {
    const adminRoutes = readFile('routes/admin.js');
    const publicRoutes = readFile('routes/public.js');

    // In admin.js, /branches, /promotions, /inventory, /tables should be mounted as sub-routers
    assert.equal(/router\.get\(\s*['"]\/branches['"]/i.test(adminRoutes), false);
    assert.equal(/router\.post\(\s*['"]\/branches['"]/i.test(adminRoutes), false);
    assert.equal(/router\.get\(\s*['"]\/promotions['"]/i.test(adminRoutes), false);
    assert.equal(/router\.get\(\s*['"]\/inventory['"]/i.test(adminRoutes), false);
    assert.equal(/router\.get\(\s*['"]\/tables['"]/i.test(adminRoutes), false);

    // In public.js, /stores, /promotions, /table/resolve, /vouchers/apply should be mounted via domain sub-routers
    assert.equal(/router\.get\(\s*['"]\/stores['"]/i.test(publicRoutes), false);
    assert.equal(/router\.get\(\s*['"]\/promotions['"]/i.test(publicRoutes), false);
    assert.equal(/router\.get\(\s*['"]\/table\/resolve['"]/i.test(publicRoutes), false);
    assert.equal(/router\.post\(\s*['"]\/vouchers\/apply['"]/i.test(publicRoutes), false);
  });
});

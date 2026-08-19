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

describe('Phase 3 Slice 2 Catalog & Menu architecture boundaries', () => {
  it('verifies catalog and menu domain route files do not import database adapters directly', () => {
    const routeFiles = [
      'routes/admin/menu.js',
      'routes/public/catalog.js',
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

  it('verifies catalog repository modules do not import Express or auth middleware', () => {
    const repoFiles = [
      'repositories/catalog.js',
      'repositories/postgres/catalog.js',
      'repositories/postgres/admin-catalog.js',
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

  it('verifies catalog services do not import Express or receive req/res objects', () => {
    const serviceFiles = [
      'services/catalog/catalog-service.js',
      'services/catalog/admin-menu-service.js',
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

  it('verifies legacy routers do not define duplicate menu or catalog handlers', () => {
    const adminRoutes = readFile('routes/admin.js');
    const publicRoutes = readFile('routes/public.js');

    // In admin.js, /menu should be mounted as sub-router, not standalone inline handlers
    assert.equal(/router\.get\(\s*['"]\/menu\/categories['"]/i.test(adminRoutes), false);
    assert.equal(/router\.post\(\s*['"]\/menu\/categories['"]/i.test(adminRoutes), false);
    assert.equal(/router\.get\(\s*['"]\/menu\/products['"]/i.test(adminRoutes), false);
    assert.equal(/router\.post\(\s*['"]\/menu\/products['"]/i.test(adminRoutes), false);
    assert.equal(/router\.get\(\s*['"]\/menu\/options['"]/i.test(adminRoutes), false);

    // In public.js, /products, /categories, /options should be mounted via router.use('/', publicCatalogRouter)
    assert.equal(/router\.get\(\s*['"]\/products['"]/i.test(publicRoutes), false);
    assert.equal(/router\.get\(\s*['"]\/products\/:slug['"]/i.test(publicRoutes), false);
    assert.equal(/router\.get\(\s*['"]\/categories['"]/i.test(publicRoutes), false);
    assert.equal(/router\.get\(\s*['"]\/search\/suggestions['"]/i.test(publicRoutes), false);
  });
});

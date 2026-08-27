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

describe('Phase 3 Slice 4 Reports, Customers & Engagement architecture boundaries', () => {
  it('verifies all domain route files do not import database adapters directly', () => {
    const routeFiles = [
      'routes/admin/reports.js',
      'routes/admin/customers.js',
      'routes/admin/settings.js',
      'routes/admin/notifications.js',
      'routes/public/engagement.js',
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
      'repositories/reports.js',
      'repositories/postgres/admin-reports.js',
      'repositories/customers.js',
      'repositories/postgres/admin-management.js',
      'repositories/engagement.js',
      'repositories/postgres/engagement.js',
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
      'services/reports/report-service.js',
      'services/customers/customer-service.js',
      'services/engagement/engagement-service.js',
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

  it('verifies top-level router files (admin.js and public.js) contain zero database imports or raw queries', () => {
    const adminRoutes = readFile('routes/admin.js');
    const publicRoutes = readFile('routes/public.js');

    assert.equal(/config\/db/i.test(adminRoutes), false, 'admin.js must not import db');
    assert.equal(/postgresDb/i.test(adminRoutes), false, 'admin.js must not reference postgresDb');
    assert.equal(/config\/db/i.test(publicRoutes), false, 'public.js must not import db');
    assert.equal(/postgresDb/i.test(publicRoutes), false, 'public.js must not reference postgresDb');

    // Both files should be clean mount hubs
    assert.ok(adminRoutes.split('\n').length <= 50, 'admin.js must be a compact mounting hub');
    assert.ok(publicRoutes.split('\n').length <= 90, 'public.js must be a compact mounting hub');
  });
});

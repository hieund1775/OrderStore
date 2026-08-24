import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { seedDemoData } from '../database/postgres/seed-demo.js';
import postgresDb from '../config/db-postgres.js';
import publicRoutes from '../routes/public.js';
import { createCatalogRepository } from '../repositories/postgres/catalog.js';
import { createEngagementRepository } from '../repositories/postgres/engagement.js';

const isPostgresIntegration = process.env.POSTGRES_INTEGRATION === '1';
const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

async function request(server, path) {
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
  return { status: response.status, body: await response.json() };
}

describe('PostgreSQL Public Read Integration Suite', () => {
  it('serves catalog and store GET contracts through PostgreSQL repositories', async (t) => {
    if (!isPostgresIntegration || !testDbUrl) {
      t.skip('Skipping live PostgreSQL public-read integration: Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL pointing to dedicated test DB');
      return;
    }

    const guard = validatePostgresTestGuard(testDbUrl);
    assert.equal(guard.valid, true, guard.reason || 'PostgreSQL integration target must be a dedicated test database');
    await postgresDb.close();
    await runMigrations();
    await seedDemoData();

    const engagement = createEngagementRepository(postgresDb);
    await postgresDb.query('INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [5, 1]);
    assert.equal((await engagement.listUserWishlist(5))[0]?.product_name, 'Trà Đào Cam Sả');

    const app = express();
    app.use(publicRoutes);
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
      const [products, detail, categories, options, stores, districts, jobs, tiers, rewards, reviews, suggestions] = await Promise.all([
        request(server, '/products?search=Trà'),
        request(server, '/products/tra-dao-cam-sa'),
        request(server, '/categories'),
        request(server, '/options/toppings'),
        request(server, '/stores?city=Hồ%20Chí%20Minh'),
        request(server, '/stores/districts'),
        request(server, '/jobs'),
        request(server, '/tiers'),
        request(server, '/rewards'),
        request(server, '/products/1/reviews'),
        request(server, '/search/suggestions?q=Trà'),
      ]);

      assert.equal(products.status, 200);
      assert.ok(Array.isArray(products.body));
      assert.equal(detail.status, 200);
      assert.equal(detail.body.slug, 'tra-dao-cam-sa');
      for (const response of [categories, options, stores, districts, jobs, tiers, rewards, reviews]) {
        assert.equal(response.status, 200);
        assert.ok(Array.isArray(response.body));
      }
      assert.equal(suggestions.status, 200);
      assert.ok(Array.isArray(suggestions.body.products));
      assert.ok(Array.isArray(suggestions.body.toppings));
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await postgresDb.close();
    }
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { getPostgresPoolConfig } from '../config/db-postgres.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { seedDemoData } from '../database/postgres/seed-demo.js';
import { createEngagementRepository } from '../repositories/postgres/engagement.js';
import { createAdminCatalogRepository } from '../repositories/postgres/admin-catalog.js';

const { Pool } = pg;
const isPostgresIntegration = process.env.POSTGRES_INTEGRATION === '1';
const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const testDir = path.dirname(fileURLToPath(import.meta.url));
const cleanupMigrationPath = path.join(
  testDir,
  '..',
  'database',
  'postgres',
  'migrations',
  '0010_wishlist_inactive_product_cleanup.sql',
);

function requireDedicatedDatabase(t) {
  if (!isPostgresIntegration || !testDbUrl) {
    t.skip('Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL for a dedicated test database');
    return false;
  }
  const guard = validatePostgresTestGuard(testDbUrl);
  assert.equal(guard.valid, true, guard.reason || 'Target must be a dedicated test database');
  return true;
}

function createDatabaseAdapter(pool) {
  return {
    async query(sql, params = []) {
      const result = await pool.query(sql, params);
      return [result.rows, result.rowCount ?? 0];
    },
    async transaction(callback) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx = {
          async query(sql, params = []) {
            const result = await client.query(sql, params);
            return [result.rows, result.rowCount ?? 0];
          },
        };
        const value = await callback(tx, client);
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

async function createFixture(pool, { available = true } = {}) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const phone = `09${String(Math.floor(Math.random() * 100_000_000)).padStart(8, '0')}`;
  const userResult = await pool.query(
    `INSERT INTO users (fullname, phone, is_admin, is_active)
     VALUES ($1, $2, FALSE, TRUE)
     RETURNING id`,
    [`Wishlist Test ${suffix}`, phone],
  );
  const productResult = await pool.query(
    `INSERT INTO products (category_id, name, slug, base_tea, price, is_available)
     VALUES (1, $1, $2, 'Trà test', 45000, $3)
     RETURNING id`,
    [`Wishlist Product ${suffix}`, `wishlist-product-${suffix}`, available],
  );
  return {
    userId: Number(userResult.rows[0].id),
    productId: Number(productResult.rows[0].id),
  };
}

async function cleanupFixture(pool, fixture) {
  if (!fixture) return;
  await pool.query('DELETE FROM wishlists WHERE user_id = $1 OR product_id = $2', [fixture.userId, fixture.productId]);
  await pool.query('DELETE FROM notifications WHERE user_id = $1', [fixture.userId]);
  await pool.query('DELETE FROM products WHERE id = $1', [fixture.productId]);
  await pool.query('DELETE FROM users WHERE id = $1', [fixture.userId]);
}

describe('PostgreSQL Wishlist & Availability Integration Suite', () => {
  it('serializes concurrent ensure and disable operations without stale wishlist rows', async (t) => {
    if (!requireDedicatedDatabase(t)) return;

    const pool = new Pool(getPostgresPoolConfig(testDbUrl));
    let fixture;
    try {
      await runMigrations({ customUrl: testDbUrl, pool });
      await seedDemoData({ customUrl: testDbUrl, pool });
      fixture = await createFixture(pool);

      const database = createDatabaseAdapter(pool);
      const engagement = createEngagementRepository(database);
      const adminCatalog = createAdminCatalogRepository(database);

      const concurrentEnsures = await Promise.all([
        engagement.ensureUserWishlistItem(fixture.userId, fixture.productId),
        engagement.ensureUserWishlistItem(fixture.userId, fixture.productId),
      ]);
      assert.deepEqual(
        concurrentEnsures.map((result) => result.created).sort(),
        [false, true],
      );
      const duplicateCount = await pool.query(
        'SELECT COUNT(*)::int AS count FROM wishlists WHERE user_id = $1 AND product_id = $2',
        [fixture.userId, fixture.productId],
      );
      assert.equal(duplicateCount.rows[0].count, 1);

      await pool.query('DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2', [fixture.userId, fixture.productId]);
      const [ensureOutcome, disableOutcome] = await Promise.allSettled([
        engagement.ensureUserWishlistItem(fixture.userId, fixture.productId),
        adminCatalog.setProductAvailability(fixture.productId, false),
      ]);

      assert.equal(disableOutcome.status, 'fulfilled');
      if (ensureOutcome.status === 'rejected') {
        assert.equal(ensureOutcome.reason?.status, 409);
      }
      const finalState = await pool.query(
        `SELECT p.is_available,
                COUNT(w.id)::int AS wishlist_count
         FROM products p
         LEFT JOIN wishlists w ON w.product_id = p.id
         WHERE p.id = $1
         GROUP BY p.id`,
        [fixture.productId],
      );
      assert.equal(finalState.rows[0].is_available, false);
      assert.equal(finalState.rows[0].wishlist_count, 0);

      const notificationsBeforeRepeat = await pool.query(
        'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1',
        [fixture.userId],
      );
      const repeatedDisable = await adminCatalog.setProductAvailability(fixture.productId, false);
      assert.equal(repeatedDisable.changed, false);
      const notificationsAfterRepeat = await pool.query(
        'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1',
        [fixture.userId],
      );
      assert.equal(notificationsAfterRepeat.rows[0].count, notificationsBeforeRepeat.rows[0].count);

      await adminCatalog.setProductAvailability(fixture.productId, true);
      const restoredCount = await pool.query(
        'SELECT COUNT(*)::int AS count FROM wishlists WHERE user_id = $1 AND product_id = $2',
        [fixture.userId, fixture.productId],
      );
      assert.equal(restoredCount.rows[0].count, 0);
    } finally {
      try {
        await cleanupFixture(pool, fixture);
      } finally {
        await pool.end();
      }
    }
  });

  it('migration 0010 notifies and removes inactive wishlist rows atomically', async (t) => {
    if (!requireDedicatedDatabase(t)) return;

    const pool = new Pool(getPostgresPoolConfig(testDbUrl));
    let fixture;
    const client = await pool.connect();
    try {
      await runMigrations({ customUrl: testDbUrl, pool });
      await seedDemoData({ customUrl: testDbUrl, pool });
      fixture = await createFixture(pool, { available: false });
      await pool.query(
        'INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2)',
        [fixture.userId, fixture.productId],
      );

      const migrationSql = await readFile(cleanupMigrationPath, 'utf8');
      await client.query('BEGIN');
      await client.query(migrationSql);

      const wishlistInsideTransaction = await client.query(
        'SELECT COUNT(*)::int AS count FROM wishlists WHERE user_id = $1 AND product_id = $2',
        [fixture.userId, fixture.productId],
      );
      const notificationInsideTransaction = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM notifications
         WHERE user_id = $1 AND title = 'Món yêu thích tạm ngưng phục vụ'`,
        [fixture.userId],
      );
      assert.equal(wishlistInsideTransaction.rows[0].count, 0);
      assert.equal(notificationInsideTransaction.rows[0].count, 1);

      await client.query('ROLLBACK');
      const wishlistAfterRollback = await pool.query(
        'SELECT COUNT(*)::int AS count FROM wishlists WHERE user_id = $1 AND product_id = $2',
        [fixture.userId, fixture.productId],
      );
      const notificationAfterRollback = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM notifications
         WHERE user_id = $1 AND title = 'Món yêu thích tạm ngưng phục vụ'`,
        [fixture.userId],
      );
      assert.equal(wishlistAfterRollback.rows[0].count, 1);
      assert.equal(notificationAfterRollback.rows[0].count, 0);
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // The original assertion/query error remains primary; cleanup below is still mandatory.
      }
      throw error;
    } finally {
      client.release();
      try {
        await cleanupFixture(pool, fixture);
      } finally {
        await pool.end();
      }
    }
  });
});

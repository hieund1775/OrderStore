import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { validatePostgresTestGuard } from '../config/postgres-guard.js';
import { runMigrations } from '../database/postgres/migrate.js';
import { seedDemoData } from '../database/postgres/seed-demo.js';
import postgresDb from '../config/db-postgres.js';
import { createUsersRepository } from '../repositories/postgres/users.js';
import { createOtpRepository } from '../repositories/postgres/otp.js';

const isPostgresIntegration = process.env.POSTGRES_INTEGRATION === '1';
const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

describe('PostgreSQL Identity Integration Suite', () => {
  it('executes admin identity, Google identity, and atomic OTP verification on PostgreSQL', async (t) => {
    if (!isPostgresIntegration || !testDbUrl) {
      t.skip('Skipping live PostgreSQL auth integration: Requires POSTGRES_INTEGRATION=1 and TEST_DATABASE_URL pointing to dedicated test DB');
      return;
    }

    validatePostgresTestGuard(testDbUrl);
    await postgresDb.close();
    await runMigrations();
    await seedDemoData();

    const users = createUsersRepository(postgresDb);
    const otp = createOtpRepository(postgresDb);
    const suffix = `${Date.now()}${Math.floor(Math.random() * 10_000)}`;
    const phone = `09${suffix.slice(-8)}`;

    try {
      const admin = await users.findActiveAdminByPhone('0909000001');
      assert.equal(admin?.admin_role, 'super');
      assert.equal(await bcrypt.compare('admin123', admin.password_hash), true);

      const customer = await users.findOrCreateCustomerByPhone({ phone, fullname: 'Khách PostgreSQL' });
      assert.equal(customer.phone, phone);
      assert.equal(customer.is_admin, false);
      assert.equal((await users.findOrCreateCustomerByPhone({ phone, fullname: 'Tên khác' })).id, customer.id);

      const googleUser = await users.findOrCreateGoogleCustomer({
        subject: `google-${suffix}`,
        email: `google-${suffix}@example.test`,
        fullname: 'Google PostgreSQL',
      });
      assert.equal(googleUser.is_admin, false);
      assert.equal((await users.findOrCreateGoogleCustomer({
        subject: `google-${suffix}`,
        email: 'changed@example.test',
        fullname: 'Ignored display name',
      })).id, googleUser.id);

      const otpHash = 'a'.repeat(64);
      await otp.assertCanRequest(phone);
      await otp.createCode({ phone, codeHash: otpHash });
      assert.equal((await otp.verifyCode({ phone, codeHash: 'b'.repeat(64) })).valid, false);
      assert.equal((await otp.verifyCode({ phone, codeHash: otpHash })).valid, true);
      assert.equal((await otp.verifyCode({ phone, codeHash: otpHash })).valid, false);
    } finally {
      await postgresDb.close();
    }
  });
});

import bcrypt from 'bcryptjs';
import pg from 'pg';

const verifyOnly = process.env.QA_ACCOUNT_VERIFY_ONLY === '1';

if (!verifyOnly && process.env.CONFIRM_PRODUCTION_QA_ACCOUNTS !== '1') {
  throw new Error('Set CONFIRM_PRODUCTION_QA_ACCOUNTS=1 to run this guarded production provisioner.');
}

const password = process.env.QA_ACCOUNT_PASSWORD;
if (!verifyOnly && (!password || password.length < 12)) {
  throw new Error('QA_ACCOUNT_PASSWORD must be at least 12 characters and is never stored in this script.');
}

const connectionString = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Production database URL is not configured.');

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stores = await client.query(
      'SELECT id, name FROM stores WHERE is_active = TRUE ORDER BY id ASC LIMIT 2 FOR SHARE',
    );
    if (stores.rows.length < 2) {
      throw new Error('At least two active branches are required for the QA account matrix. No accounts were created.');
    }

    const [branchA, branchB] = stores.rows;
    const accounts = [
      ['QA Super Admin', '0999000001', 'qa.super@qa.teaplus.invalid', 'super', null],
      ['QA Manager A', '0999000002', 'qa.manager.a@qa.teaplus.invalid', 'manager', branchA.id],
      ['QA Manager B', '0999000003', 'qa.manager.b@qa.teaplus.invalid', 'manager', branchB.id],
      ['QA Cashier A', '0999000004', 'qa.cashier.a@qa.teaplus.invalid', 'cashier', branchA.id],
      ['QA Kitchen A', '0999000005', 'qa.kitchen.a@qa.teaplus.invalid', 'kitchen', branchA.id],
      ['QA Packing A', '0999000006', 'qa.packing.a@qa.teaplus.invalid', 'packing', branchA.id],
      ['QA Customer 1', '0999000007', 'qa.customer.1@qa.teaplus.invalid', null, null],
      ['QA Customer 2', '0999000008', 'qa.customer.2@qa.teaplus.invalid', null, null],
    ];

    const existing = await client.query(
      'SELECT phone, email, admin_role, admin_branch_id, is_active FROM users WHERE phone = ANY($1::varchar[]) OR email = ANY($2::varchar[]) FOR SHARE',
      [accounts.map(([, phone]) => phone), accounts.map(([, , email]) => email)],
    );
    if (verifyOnly) {
      await client.query('ROLLBACK');
      console.log(JSON.stringify({ accounts: existing.rows, count: existing.rows.length }));
    } else {
    if (existing.rows.length > 0) {
      throw new Error(`QA identity collision detected; no accounts were changed: ${existing.rows.map((row) => row.phone || row.email).join(', ')}`);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    for (const [fullname, phone, email, role, branchId] of accounts) {
      await client.query(
        `INSERT INTO users (
          fullname, phone, email, password_hash, tier, points, total_spent,
          is_admin, admin_role, admin_branch_id, is_active, email_verified_at
        ) VALUES ($1, $2, $3, $4, 'Đồng', 0, 0, $5, $6, $7, TRUE, CURRENT_TIMESTAMP)`,
        [fullname, phone, email, passwordHash, role !== null, role, branchId],
      );
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({
      created: accounts.map(([fullname, phone, email, role, branchId]) => ({ fullname, phone, email, role: role || 'customer', branchId })),
      branches: { a: branchA, b: branchB },
    }));
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}

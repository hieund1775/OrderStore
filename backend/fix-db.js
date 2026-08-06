import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const server = process.env.DB_SERVER || 'localhost\\SQLEXPRESS';
const isTrusted = process.env.DB_TRUSTED === 'true';

const config = {
  server,
  database: process.env.DB_NAME || 'teaplus_db',
  options: {
    trustServerCertificate: true,
    encrypt: false,
    trustedConnection: isTrusted,
  },
};
if (!isTrusted) {
  config.user = process.env.DB_USER || 'sa';
  config.password = process.env.DB_PASSWORD || '';
}

const conn = await sql.connect(config);
console.log('connected');

// Check columns
const cols = await conn.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='promotions'`);
console.log('columns:', cols.recordset.map(x => x.COLUMN_NAME).join(', '));

// Add voucher_type
try {
  await conn.request().query(`ALTER TABLE promotions ADD voucher_type NVARCHAR(20) NULL`);
  console.log('voucher_type added');
} catch(e) {
  console.log('voucher_type:', e.message);
}

// Add usage_limit
try {
  await conn.request().query(`ALTER TABLE promotions ADD usage_limit INT NULL`);
  console.log('usage_limit added');
} catch(e) {
  console.log('usage_limit:', e.message);
}

// Add used_count
try {
  await conn.request().query(`ALTER TABLE promotions ADD used_count INT NOT NULL DEFAULT 0`);
  console.log('used_count added');
} catch(e) {
  console.log('used_count:', e.message);
}

// Update admin passwords
const hash = '$2b$10$dMZV3C5n2bxlJjmDxNl4WeanEq/6im01.s.pX1MEuJw9jFJKQwrHa';
try {
  const r = await conn.request().query(`UPDATE users SET password_hash = '${hash}' WHERE is_admin = 1`);
  console.log('passwords updated');
} catch(e) {
  console.log('passwords:', e.message);
}

// Create tables table
try {
  await conn.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tables]') AND type = 'U')
    CREATE TABLE tables (
      id INT IDENTITY(1,1) PRIMARY KEY,
      store_id INT NOT NULL REFERENCES stores(id),
      name NVARCHAR(100) NOT NULL,
      location NVARCHAR(200) NULL,
      qr_code_token NVARCHAR(100) NOT NULL UNIQUE,
      is_active BIT NOT NULL DEFAULT 1,
      created_at DATETIME2 NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('tables table ok');
} catch(e) {
  console.log('tables:', e.message);
}

// Create voucher_usage_history
try {
  await conn.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[voucher_usage_history]') AND type = 'U')
    CREATE TABLE voucher_usage_history (
      id INT IDENTITY(1,1) PRIMARY KEY,
      voucher_code NVARCHAR(50) NOT NULL,
      user_phone NVARCHAR(20) NOT NULL,
      order_id INT NULL,
      used_at DATETIME2 NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('voucher_usage_history table ok');
} catch(e) {
  console.log('voucher_usage_history:', e.message);
}

// Seed tables
try {
  const tc = await conn.request().query('SELECT COUNT(*) as cnt FROM tables');
  if (tc.recordset[0].cnt === 0) {
    for (let i = 1; i <= 5; i++) {
      const name = `Bàn ${String(i).padStart(2, '0')}`;
      const loc = `Tầng ${i <= 3 ? '1' : '2'}`;
      const token = `qr-table-${i}-${Math.random().toString(36).slice(2, 10)}`;
      await conn.request().query(`INSERT INTO tables (store_id, name, location, qr_code_token) VALUES (1, N'${name}', N'${loc}', '${token}')`);
    }
    console.log('tables seeded');
  } else {
    console.log('tables already have data');
  }
} catch(e) {
  console.log('tables seed:', e.message);
}

// Update voucher_type for existing promotions
try {
  await conn.request().query(`UPDATE promotions SET voucher_type = 'time_bounded' WHERE code IS NOT NULL AND voucher_type IS NULL`);
  console.log('voucher_type updated');
} catch(e) {
  console.log('voucher_type update:', e.message);
}

await conn.close();
console.log('done');
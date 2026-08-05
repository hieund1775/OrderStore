// init-db.js — Tạo database + import schema + seed vào SQL Server
// Chạy: node init-db.js
import sqlAuth from 'mssql';
import sqlTrusted from 'mssql/msnodesqlv8.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

// Windows Auth → msnodesqlv8 (ODBC); SQL Auth → mssql (tedious)
const isTrusted = process.env.DB_TRUSTED === 'true';
const sql = isTrusted ? sqlTrusted : sqlAuth;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Kết nối master để tạo database
  const conn = await sql.connect({
    server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
    database: 'master',
    options: {
      trustServerCertificate: true,
      encrypt: false,
      trustedConnection: process.env.DB_TRUSTED === 'true',
    },
    ...(process.env.DB_TRUSTED !== 'true' ? {
      user: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD || '',
    } : {}),
  });

  console.log('✅ Đã kết nối SQL Server');

  // Chạy schema.sql (đã có CREATE DATABASE bên trong)
  const schema = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf-8');
  const batches = schema.split(/^\s*GO\s*$/im).filter(b => b.trim());
  for (const batch of batches) {
    await conn.query(batch);
  }
  console.log('✅ Schema đã tạo');

  // Chạy seed.sql
  const seed = fs.readFileSync(path.join(__dirname, 'database', 'seed.sql'), 'utf-8');
  const seedBatches = seed.split(/^\s*GO\s*$/im).filter(b => b.trim());
  for (const batch of seedBatches) {
    await conn.query(batch);
  }
  console.log('✅ Seed data đã import');

  await conn.close();
  console.log('🎉 Database teaplus_db đã sẵn sàng trên SQL Server!');
  console.log('   Chạy: npm run dev');
}

main().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});

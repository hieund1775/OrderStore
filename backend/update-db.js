import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
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
  console.log('✅ Connected');

  const updateSql = fs.readFileSync(path.join(__dirname, 'database', 'update.sql'), 'utf-8');
  const batches = updateSql.split(/^\s*GO\s*$/im).filter(b => b.trim());
  for (const batch of batches) {
    await conn.query(batch);
  }
  console.log('✅ Update completed');

  await conn.close();
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
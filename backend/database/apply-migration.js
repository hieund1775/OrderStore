import db from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  try {
    const sqlPath = path.join(__dirname, 'update-payment.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    const statements = sqlContent
      .split(/^GO/m)
      .map(s => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      console.log('Executing Migration Batch...');
      await db.query(stmt);
    }
    console.log('✅ Migration update-payment.sql executed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

main();

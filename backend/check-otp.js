import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const server = process.env.DB_SERVER || 'localhost\\SQLEXPRESS';
const isTrusted = process.env.DB_TRUSTED === 'true';
const config = {
  server, database: process.env.DB_NAME || 'teaplus_db',
  options: { trustServerCertificate: true, encrypt: false, trustedConnection: isTrusted },
};
if (!isTrusted) { config.user = process.env.DB_USER || 'sa'; config.password = process.env.DB_PASSWORD || ''; }

const conn = await sql.connect(config);
const r = await conn.request().query('SELECT TOP 3 * FROM otp_codes ORDER BY id DESC');
console.log(JSON.stringify(r.recordset, null, 2));
await conn.close();
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

// Check what GETDATE() returns
const now = await conn.request().query('SELECT GETDATE() as now');
console.log('GETDATE():', now.recordset[0].now);

// Check OTP directly
const r = await conn.request().query("SELECT *, GETDATE() as now FROM otp_codes WHERE phone = '0903118226' AND code = '816127' AND used = 0 AND expires_at > GETDATE()");
console.log('Found:', r.recordset.length);

if (!r.recordset.length) {
  // Check why
  const all = await conn.request().query("SELECT *, GETDATE() as now FROM otp_codes WHERE phone = '0903118226'");
  console.log('All OTPs:', JSON.stringify(all.recordset));
}

await conn.close();
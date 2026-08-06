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
console.log('connected');

await conn.request().query(`
  IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[otp_codes]') AND type = 'U')
  CREATE TABLE otp_codes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    phone NVARCHAR(20) NOT NULL,
    code NVARCHAR(10) NOT NULL,
    expires_at DATETIME2 NOT NULL,
    used BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  )
`);
console.log('otp_codes table ok');
await conn.close();
console.log('done');
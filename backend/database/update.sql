-- Update DB: fix passwords, add tables/columns
USE teaplus_db;
GO

-- Update admin passwords
DECLARE @hash NVARCHAR(255) = '$2b$10$dMZV3C5n2bxlJjmDxNl4WeanEq/6im01.s.pX1MEuJw9jFJKQwrHa';
UPDATE users SET password_hash = @hash WHERE is_admin = 1;
PRINT N'✅ Passwords updated';

-- Add tables table if missing
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tables]') AND type = 'U')
BEGIN
  CREATE TABLE tables (
    id INT IDENTITY(1,1) PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id),
    name NVARCHAR(100) NOT NULL,
    location NVARCHAR(200) NULL,
    qr_code_token NVARCHAR(100) NOT NULL UNIQUE,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
  PRINT N'✅ tables created';
END

-- Add voucher_usage_history if missing
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[voucher_usage_history]') AND type = 'U')
BEGIN
  CREATE TABLE voucher_usage_history (
    id INT IDENTITY(1,1) PRIMARY KEY,
    voucher_code NVARCHAR(50) NOT NULL,
    user_phone NVARCHAR(20) NOT NULL,
    order_id INT NULL,
    used_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
  PRINT N'✅ voucher_usage_history created';
END

-- Add voucher_type to promotions
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'promotions' AND COLUMN_NAME = 'voucher_type')
BEGIN
  ALTER TABLE promotions ADD voucher_type NVARCHAR(20) NULL;
  PRINT N'✅ voucher_type added';
END
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('promotions') AND name LIKE '%voucher_type%')
BEGIN
  ALTER TABLE promotions ADD CONSTRAINT CK_promotions_voucher_type CHECK(voucher_type IN ('single_use','time_bounded'));
  PRINT N'✅ voucher_type check added';
END

-- Add usage_limit to promotions
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'promotions' AND COLUMN_NAME = 'usage_limit')
BEGIN
  ALTER TABLE promotions ADD usage_limit INT NULL;
  PRINT N'✅ usage_limit added';
END

-- Add used_count to promotions
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'promotions' AND COLUMN_NAME = 'used_count')
BEGIN
  ALTER TABLE promotions ADD used_count INT NOT NULL DEFAULT 0;
  PRINT N'✅ used_count added';
END

-- Seed tables
IF (SELECT COUNT(*) FROM tables) = 0
BEGIN
  INSERT INTO tables (store_id, name, location, qr_code_token) VALUES
    (1, N'Bàn 01', N'Tầng 1', 'qr-table-1-a7b3c9d1'),
    (1, N'Bàn 02', N'Tầng 1', 'qr-table-2-e2f4a6b8'),
    (1, N'Bàn 03', N'Tầng 1', 'qr-table-3-c5d7e9f0'),
    (1, N'Bàn 04', N'Tầng 2', 'qr-table-4-g1h3i5j7'),
    (1, N'Bàn 05', N'Tầng 2', 'qr-table-5-k2l4m6n8');
  PRINT N'✅ tables seeded';
END

-- Update promotions with voucher_type (only if column exists)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'promotions' AND COLUMN_NAME = 'voucher_type')
BEGIN
  UPDATE promotions SET voucher_type = 'time_bounded' WHERE code IS NOT NULL AND voucher_type IS NULL;
END

-- Add shipping driver info columns to orders table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'shipping_driver_name')
BEGIN
  ALTER TABLE orders ADD shipping_driver_name NVARCHAR(120) NULL;
  ALTER TABLE orders ADD shipping_driver_phone NVARCHAR(20) NULL;
  ALTER TABLE orders ADD shipping_tracking_url NVARCHAR(500) NULL;
  PRINT N'✅ shipping driver columns added';
END

-- Allow NULL phone for Google-login users (Google chỉ cung cấp email, không có SĐT)
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'phone' AND IS_NULLABLE = 'NO')
BEGIN
  ALTER TABLE users ALTER COLUMN phone NVARCHAR(20) NULL;
  PRINT N'✅ users.phone giờ cho phép NULL (dành cho đăng nhập Google)';
END

PRINT N'✅ Done';
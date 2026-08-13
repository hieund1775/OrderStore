-- Migration: Add payment columns to orders table for PayOS & VietQR static support
USE teaplus_db;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[orders]') AND name = 'payment_status')
BEGIN
    ALTER TABLE orders ADD payment_status NVARCHAR(20) NOT NULL DEFAULT 'unpaid';
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[orders]') AND name = 'payment_provider')
BEGIN
    ALTER TABLE orders ADD payment_provider NVARCHAR(30) NULL;
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[orders]') AND name = 'payment_link_id')
BEGIN
    ALTER TABLE orders ADD payment_link_id NVARCHAR(100) NULL;
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[orders]') AND name = 'payos_order_code')
BEGIN
    ALTER TABLE orders ADD payos_order_code BIGINT NULL;
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[orders]') AND name = 'transaction_id')
BEGIN
    ALTER TABLE orders ADD transaction_id NVARCHAR(100) NULL;
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[orders]') AND name = 'payment_created_at')
BEGIN
    ALTER TABLE orders ADD payment_created_at DATETIME NULL;
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[orders]') AND name = 'payment_expires_at')
BEGIN
    ALTER TABLE orders ADD payment_expires_at DATETIME NULL;
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[orders]') AND name = 'paid_at')
BEGIN
    ALTER TABLE orders ADD paid_at DATETIME NULL;
END;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[orders]') AND name = 'paid_verified_by')
BEGIN
    ALTER TABLE orders ADD paid_verified_by INT NULL;
END;
GO

-- Check constraint for payment_status
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_orders_payment_status')
BEGIN
    ALTER TABLE orders ADD CONSTRAINT CK_orders_payment_status CHECK (payment_status IN ('unpaid','paid','expired'));
END;
GO

-- Update existing orders to 'paid' so existing order history & KPIs remain unchanged
UPDATE orders SET payment_status = 'paid' WHERE payment_status = 'unpaid';
GO
GO

-- Unique index on payos_order_code to avoid duplicate payment codes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UX_orders_payos_order_code' AND object_id = OBJECT_ID(N'[dbo].[orders]'))
BEGIN
    CREATE UNIQUE INDEX UX_orders_payos_order_code ON orders(payos_order_code) WHERE payos_order_code IS NOT NULL;
END;
GO

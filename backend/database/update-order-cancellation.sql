-- ====================================================================
-- Migration: Add cancel_token_hash to orders table for secure guest cancellation
-- ====================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[orders]')
      AND name = 'cancel_token_hash'
)
BEGIN
    ALTER TABLE orders ADD cancel_token_hash CHAR(64) NULL;
    PRINT '✅ Đã thêm cột cancel_token_hash vào bảng orders';
END
ELSE
BEGIN
    PRINT 'ℹ️ Cột cancel_token_hash đã tồn tại trong bảng orders';
END
GO

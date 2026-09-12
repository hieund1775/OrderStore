-- 0031_table_qr_guest_dinein.sql
-- Additive QR-table guest checkout support. Existing raw qr_code_token values
-- remain legacy display data and are never accepted as checkout credentials.

ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS qr_checkout_token_hash CHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS qr_checkout_token_rotated_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tables_qr_checkout_token_hash
  ON tables(qr_checkout_token_hash)
  WHERE qr_checkout_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tables_qr_checkout_active
  ON tables(qr_checkout_token_hash, store_id)
  WHERE qr_checkout_token_hash IS NOT NULL AND is_active = TRUE;

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS applies_to_table_qr BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
DECLARE
  existing_constraint RECORD;
BEGIN
  FOR existing_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%order_type%'
  LOOP
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', existing_constraint.conname);
  END LOOP;

  ALTER TABLE orders
    ADD CONSTRAINT chk_orders_order_type
    CHECK (order_type IN ('Delivery', 'Take-away', 'POS', 'Dine-in'));
END $$;

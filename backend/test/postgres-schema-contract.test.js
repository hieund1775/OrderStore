import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const coreMigrationPath = path.join(testDir, '..', 'database', 'postgres', 'migrations', '0001_core.sql');

test('PostgreSQL baseline preserves the active backend column and enum contract', async () => {
  const sql = await readFile(coreMigrationPath, 'utf8');

  const requiredFragments = [
    'admin_role VARCHAR(20)', 'admin_branch_id BIGINT', 'token_version INTEGER',
    'city VARCHAR(100)', 'district VARCHAR(100)', 'hours VARCHAR(100)', 'amenities TEXT',
    'slug VARCHAR(150)', 'sort_order INTEGER', 'is_visible BOOLEAN',
    'base_tea VARCHAR(100)', 'image_url TEXT', 'is_available BOOLEAN',
    'qr_code_token VARCHAR(100)', 'table_id BIGINT', 'location_name VARCHAR(200)',
    "order_type IN ('Delivery', 'Take-away', 'POS')",
    "payment_status IN ('unpaid', 'paid', 'expired')",
    'payment_provider VARCHAR(30)', 'payment_expires_at TIMESTAMPTZ', 'delivery_addr VARCHAR(300)',
    'cancel_token_hash CHAR(64)', 'size_label VARCHAR(50)', 'sugar_level VARCHAR(50)',
    'ice_level VARCHAR(50)', 'unit_price INTEGER', 'changed_by BIGINT', 'user_phone VARCHAR(20)',
    "status IN ('Chờ xác nhận', 'Đã xác nhận', 'Đang chuẩn bị', 'Đang giao', 'Hoàn thành', 'Đã hủy')",
  ];

  for (const fragment of requiredFragments) {
    assert.ok(sql.includes(fragment), `missing active backend schema contract: ${fragment}`);
  }
  assert.equal(sql.includes('table_number VARCHAR'), false, 'legacy routes use table_id, not table_number');
  assert.equal(sql.includes('product_price BIGINT'), false, 'legacy routes use unit_price, not product_price');
});

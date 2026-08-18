import pg from 'pg';
import { getPostgresPoolConfig } from '../../config/db-postgres.js';
import { validatePostgresTestGuard, redactDatabaseUrl } from '../../config/postgres-guard.js';

const { Pool } = pg;

async function resetIdentitySequences(client) {
  for (const table of ['stores', 'users', 'categories', 'products', 'size_options', 'sugar_options', 'ice_options', 'toppings', 'promotions', 'ingredients']) {
    await client.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`, [table]);
  }
}

/** Seeds a deterministic, route-compatible demo dataset into a guarded non-production database. */
export async function seedDemoData({ customUrl = null, pool = null } = {}) {
  const targetUrl = customUrl || process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  validatePostgresTestGuard(targetUrl);
  console.log(`🌱 [PostgreSQL Seeder] Target DB: ${redactDatabaseUrl(targetUrl)}`);

  const activePool = pool || new Pool(getPostgresPoolConfig(customUrl));
  const client = await activePool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO stores (id, name, city, district, address, hours, phone, amenities, is_active)
      VALUES
        (1, 'TeaPlus Quận 1 - Nguyễn Huệ', 'Hồ Chí Minh', 'Quận 1', '123 Nguyễn Huệ', '08:00-22:00', '02838221101', '["wifi"]', true),
        (2, 'TeaPlus Bình Thạnh - D2', 'Hồ Chí Minh', 'Bình Thạnh', '45 Nguyễn Gia Trí', '08:00-22:00', '02838221102', '["wifi"]', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address, is_active = EXCLUDED.is_active;
    `);
    await client.query(`
      INSERT INTO users (id, fullname, phone, email, password_hash, tier, points, is_admin, admin_role, admin_branch_id)
      VALUES
        (1, 'Super Administrator', '0909000001', 'superadmin@teaplus.vn', '$2b$10$gEYcHSjbADGTsuW3jdWNTOR8V4k2/QhFerK75RIcblsYYGXOn033W', 'Kim Cương', 1000, true, 'super', NULL),
        (2, 'Quản lý Chi nhánh 1', '0909000002', 'manager1@teaplus.vn', '$2b$10$gEYcHSjbADGTsuW3jdWNTOR8V4k2/QhFerK75RIcblsYYGXOn033W', 'Vàng', 500, true, 'manager', 1),
        (3, 'Thu ngân Chi nhánh 1', '0909000003', 'cashier1@teaplus.vn', '$2b$10$gEYcHSjbADGTsuW3jdWNTOR8V4k2/QhFerK75RIcblsYYGXOn033W', 'Bạc', 200, true, 'cashier', 1),
        (4, 'Đầu bếp Chi nhánh 1', '0909000004', 'kitchen1@teaplus.vn', '$2b$10$gEYcHSjbADGTsuW3jdWNTOR8V4k2/QhFerK75RIcblsYYGXOn033W', 'Đồng', 0, true, 'kitchen', 1),
        (5, 'Nguyễn Khách Hàng', '0901234567', 'customer@example.com', NULL, 'Vàng', 350, false, NULL, NULL)
      ON CONFLICT (id) DO UPDATE SET fullname = EXCLUDED.fullname, password_hash = EXCLUDED.password_hash, admin_role = EXCLUDED.admin_role, admin_branch_id = EXCLUDED.admin_branch_id;
    `);
    await client.query(`
      INSERT INTO categories (id, name, slug, sort_order, is_visible) VALUES
        (1, 'Trà Trái Cây Tươi', 'tra-trai-cay-tuoi', 1, true),
        (2, 'Trà Sữa Đậm Vị', 'tra-sua-dam-vi', 2, true),
        (3, 'Trà Nguyên Bản', 'tra-nguyen-ban', 3, true),
        (4, 'Đá Xay & Sinh Tố', 'da-xay-sinh-to', 4, true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug;
    `);
    await client.query(`
      INSERT INTO products (id, category_id, name, slug, base_tea, description, price, is_available) VALUES
        (1, 1, 'Trà Đào Cam Sả', 'tra-dao-cam-sa', 'Trà đen', 'Trà đen với đào, cam và sả', 45000, true),
        (2, 1, 'Trà Dâu Tằm Pha Lê Tuyết', 'tra-dau-tam', 'Trà lài', 'Trà lài và dâu tằm', 52000, true),
        (3, 2, 'Trà Sữa Ô Long Nướng', 'tra-sua-o-long-nuong', 'Ô long', 'Ô long và sữa tươi', 48000, true),
        (4, 3, 'Trà Lài Hoàng Kim', 'tra-lai-hoang-kim', 'Trà lài', 'Trà xanh hoa lài', 35000, true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, price = EXCLUDED.price, is_available = EXCLUDED.is_available;
    `);
    await client.query(`
      INSERT INTO size_options (id, label, name, price_extra, sort_order) VALUES
        (1, 'M', 'Size M (Tiêu chuẩn)', 0, 1), (2, 'L', 'Size L (Lớn)', 8000, 2)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
      INSERT INTO sugar_options (id, label, sort_order) VALUES
        (1, '100% Đường', 1), (2, '70% Đường', 2), (3, '50% Đường', 3), (4, '30% Đường', 4), (5, '0% Đường', 5)
      ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label;
      INSERT INTO ice_options (id, label, sort_order) VALUES
        (1, '100% Đá', 1), (2, '70% Đá', 2), (3, '50% Đá', 3), (4, '30% Đá', 4), (5, '0% Đá', 5)
      ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label;
      INSERT INTO toppings (id, name, price, is_available, sort_order) VALUES
        (1, 'Trân châu đen dẻo', 5000, true, 1), (2, 'Trân châu hoàng kim', 7000, true, 2),
        (3, 'Thạch nha đam tươi', 6000, true, 3), (4, 'Kem Macchiato Phô Mai', 12000, true, 4)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price;
    `);
    await client.query(`
      INSERT INTO promotions (id, title, type, code, description, discount_type, discount_value, min_order, start_date, end_date, is_active) VALUES
        (1, 'Giảm 20% đơn đầu tiên', 'voucher', 'CHAOBANMOI', 'Ưu đãi cho khách mới', 'percent', 20, 50000, '2026-01-01', '2026-12-31', true),
        (2, 'Giảm trực tiếp 15.000đ', 'voucher', 'TEAPLUS15K', 'Áp dụng đơn từ 60.000đ', 'fixed', 15000, 60000, '2026-01-01', '2026-12-31', true)
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;
      INSERT INTO promotion_stores (promotion_id, store_id) VALUES (1, 1), (1, 2), (2, 1), (2, 2) ON CONFLICT DO NOTHING;
    `);
    await client.query(`
      INSERT INTO ingredients (id, store_id, name, kind, unit, stock, safe_level) VALUES
        (1, 1, 'Trà đen', 'dry', 'g', 5000, 1000),
        (2, 1, 'Sữa tươi', 'fresh', 'ml', 1800, 500),
        (3, 2, 'Trà lài', 'dry', 'g', 4200, 900),
        (4, 2, 'Đào ngâm', 'canned', 'g', 750, 300)
      ON CONFLICT (id) DO UPDATE SET
        store_id = EXCLUDED.store_id,
        name = EXCLUDED.name,
        kind = EXCLUDED.kind,
        unit = EXCLUDED.unit,
        stock = EXCLUDED.stock,
        safe_level = EXCLUDED.safe_level,
        updated_at = CURRENT_TIMESTAMP;
    `);
    await resetIdentitySequences(client);
    await client.query('COMMIT');
    return { stores: 2, users: 5, categories: 4, products: 4, toppings: 4, promotions: 2, ingredients: 4 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    if (!pool) await activePool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed-demo.js')) {
  seedDemoData().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
}

import pg from 'pg';
import { getPostgresPoolConfig } from '../../config/db-postgres.js';
import { validatePostgresTestGuard, redactDatabaseUrl } from '../../config/postgres-guard.js';

const { Pool } = pg;

/**
 * Seeds deterministic demo dataset into PostgreSQL for development and testing
 */
export async function seedDemoData({ customUrl = null, pool = null } = {}) {
  const targetUrl = customUrl || process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;

  // Enforce guard
  validatePostgresTestGuard(targetUrl);
  console.log(`🌱 [PostgreSQL Seeder] Seeding demo data into: ${redactDatabaseUrl(targetUrl)}`);

  const activePool = pool || new Pool(getPostgresPoolConfig(customUrl));
  const client = await activePool.connect();

  try {
    await client.query('BEGIN');

    // 1. Demo Stores
    await client.query(`
      INSERT INTO stores (id, name, address, phone, manager_name, is_active)
      VALUES 
        (1, 'TeaPlus Quận 1 - Nguyễn Huệ', '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM', '02838221101', 'Nguyễn Quản Lý', true),
        (2, 'TeaPlus Bình Thạnh - D2', '45 Nguyễn Gia Trí, Phường 25, Bình Thạnh, TP.HCM', '02838221102', 'Trần Quản Lý', true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address;
    `);

    // 2. Demo Users (Admin, Kitchen, Cashier, Customer)
    await client.query(`
      INSERT INTO users (id, phone, email, fullname, role, is_admin, branch_id, tier, points)
      VALUES
        (1, '0909000001', 'superadmin@teaplus.vn', 'Super Administrator', 'super', true, NULL, 'Kim Cương', 1000),
        (2, '0909000002', 'manager1@teaplus.vn', 'Quản Lý Chi Nhánh 1', 'manager', true, 1, 'Vàng', 500),
        (3, '0909000003', 'cashier1@teaplus.vn', 'Thu Ngân Chi Nhánh 1', 'cashier', true, 1, 'Bạc', 200),
        (4, '0909000004', 'kitchen1@teaplus.vn', 'Đầu Bếp Chi Nhánh 1', 'kitchen', true, 1, 'Đồng', 0),
        (5, '0901234567', 'customer@example.com', 'Nguyễn Khách Hàng', 'customer', false, NULL, 'Vàng', 350)
      ON CONFLICT (id) DO UPDATE SET fullname = EXCLUDED.fullname, role = EXCLUDED.role;
    `);

    // 3. Demo Categories
    await client.query(`
      INSERT INTO categories (id, name, icon, display_order, is_active)
      VALUES
        (1, 'Trà Trái Cây Tươi', 'citrus', 1, true),
        (2, 'Trà Sữa Đậm Vị', 'coffee', 2, true),
        (3, 'Trà Nguyên Bản', 'cup-soda', 3, true),
        (4, 'Đá Xay & Sinh Tố', 'sparkles', 4, true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
    `);

    // 4. Demo Products
    await client.query(`
      INSERT INTO products (id, category_id, name, description, price, is_best_seller, is_new, is_active, display_order)
      VALUES
        (1, 1, 'Trà Đào Cam Sả', 'Trà đen hòa quyện đào tươi giòn, cam vàng mọng nước và sả thanh mát', 45000, true, false, true, 1),
        (2, 1, 'Trà Dâu Tằm Pha Lê Tuyết', 'Trà lài kết hợp dâu tằm Đà Lạt và thạch pha lê giòn dai', 52000, true, true, true, 2),
        (3, 2, 'Trà Sữa Ô Long Nướng', 'Trà ô long sấy đậm vị hòa quyện sữa tươi béo ngậy', 48000, true, false, true, 3),
        (4, 3, 'Trà Lài Hoàng Kim', 'Trà xanh ướp hoa lài organic thơm ngát thanh tao', 35000, false, false, true, 4)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price;
    `);

    // 5. Demo Options
    await client.query(`
      INSERT INTO size_options (id, name, extra_price, is_active, display_order)
      VALUES (1, 'Size M (Tiêu chuẩn)', 0, true, 1), (2, 'Size L (Lớn)', 8000, true, 2)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

      INSERT INTO sugar_options (id, name, is_active, display_order)
      VALUES (1, '100% Đường (Chuẩn)', true, 1), (2, '70% Đường', true, 2), (3, '50% Đường', true, 3), (4, '30% Đường', true, 4), (5, '0% Không đường', true, 5)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

      INSERT INTO ice_options (id, name, is_active, display_order)
      VALUES (1, '100% Đá (Chuẩn)', true, 1), (2, '70% Đá', true, 2), (3, '50% Đá', true, 3), (4, '30% Đá', true, 4), (5, '0% Không đá', true, 5)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

      INSERT INTO toppings (id, name, price, is_active, display_order)
      VALUES
        (1, 'Trân châu đen dẻo', 5000, true, 1),
        (2, 'Trân châu hoàng kim', 7000, true, 2),
        (3, 'Thạch nha đam tươi', 6000, true, 3),
        (4, 'Kem Macchiato Phô Mai', 12000, true, 4)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price;
    `);

    // 6. Demo Promotions
    await client.query(`
      INSERT INTO promotions (id, code, title, description, discount_type, discount_value, min_order_value, start_date, end_date, is_active)
      VALUES
        (1, 'CHAOBANMOI', 'Giảm 20% đơn đầu tiên', 'Ưu đãi dành riêng cho khách hàng mới', 'percent', 20, 50000, '2026-01-01', '2026-12-31', true),
        (2, 'TEAPLUS15K', 'Giảm trực tiếp 15.000đ', 'Áp dụng cho mọi đơn từ 60.000đ', 'fixed', 15000, 60000, '2026-01-01', '2026-12-31', true)
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

      INSERT INTO promotion_stores (promotion_id, store_id)
      VALUES (1, 1), (1, 2), (2, 1), (2, 2)
      ON CONFLICT DO NOTHING;
    `);

    // Reset Postgres Identity sequences
    await client.query(`
      SELECT setval(pg_get_serial_sequence('stores', 'id'), COALESCE(MAX(id), 1)) FROM stores;
      SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;
      SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE(MAX(id), 1)) FROM categories;
      SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE(MAX(id), 1)) FROM products;
      SELECT setval(pg_get_serial_sequence('toppings', 'id'), COALESCE(MAX(id), 1)) FROM toppings;
      SELECT setval(pg_get_serial_sequence('promotions', 'id'), COALESCE(MAX(id), 1)) FROM promotions;
    `);

    await client.query('COMMIT');
    console.log('✅ Demo seed completed successfully.');

    return {
      stores: 2,
      users: 5,
      categories: 4,
      products: 4,
      toppings: 4,
      promotions: 2,
    };
  } catch (seedErr) {
    await client.query('ROLLBACK');
    console.error('❌ Demo seed failed:', seedErr.message);
    throw seedErr;
  } finally {
    client.release();
    if (!pool) {
      await activePool.end();
    }
  }
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('seed-demo.js')) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

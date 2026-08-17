import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Strict allowlist: Only dedicated test or performance databases. Default 'teaplus_db' is strictly forbidden.
const DEFAULT_ALLOWED_PATTERNS = [/_test$/i, /_perf$/i, /teaplus_test$/i, /teaplus_perf$/i];

export const VALID_SCHEMA_ORDER_TYPES = ['Delivery', 'Take-away', 'POS'];
export const VALID_SCHEMA_PAYMENT_STATUSES = ['unpaid', 'paid', 'expired'];
export const VALID_SCHEMA_PAYMENT_METHODS = ['COD', 'VietQR', 'MoMo', 'ZaloPay'];
export const VALID_SCHEMA_ORDER_STATUSES = ['Đang chuẩn bị', 'Chờ xác nhận', 'Đang giao', 'Hoàn thành', 'Đã hủy'];

export function validatePerfGuard({
  nodeEnv = process.env.NODE_ENV,
  dbName = process.env.DB_NAME,
  confirmFlag = process.env.PERF_SEED_CONFIRM,
} = {}) {
  if (nodeEnv === 'production') {
    throw new Error('GUARDS VIOLATION: Seeding performance data is strictly forbidden in production mode (NODE_ENV=production).');
  }

  // Primary application database is strictly forbidden under all circumstances
  if (/^teaplus_db$/i.test(String(dbName || ''))) {
    throw new Error(
      `GUARDS VIOLATION: Database "${dbName}" is the primary application database. ` +
      `Seeding and benchmark mutations on the primary database are strictly forbidden. ` +
      `You MUST connect to a dedicated test/performance database (e.g. "teaplus_perf" or "teaplus_test").`
    );
  }

  const isAllowedDb = DEFAULT_ALLOWED_PATTERNS.some((pattern) => pattern.test(String(dbName || '')));
  if (!isAllowedDb) {
    throw new Error(
      `GUARDS VIOLATION: Database "${dbName}" is not on the test/performance allowlist. ` +
      `Database name MUST end with "_perf" or "_test" (e.g. "teaplus_perf").`
    );
  }

  if (confirmFlag !== '1' && confirmFlag !== 'true') {
    throw new Error('GUARDS VIOLATION: Missing PERF_SEED_CONFIRM=1 confirmation flag or --confirm argument.');
  }

  return true;
}

// Deterministic PRNG: Mulberry32
export function createPrng(seed = 42) {
  let s = Math.floor(seed) >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDeterministicOrders({ seed = 42, count = 100, days = 90, prefix = 'TP' } = {}) {
  const rand = createPrng(seed);
  const orders = [];
  const now = new Date('2026-08-17T12:00:00.000Z');
  const msPerDay = 86400000;

  for (let i = 1; i <= count; i++) {
    const dayOffset = rand() * days;
    const createdAt = new Date(now.getTime() - dayOffset * msPerDay);
    const storeId = 1 + Math.floor(rand() * 5); // 1..5
    const orderType = VALID_SCHEMA_ORDER_TYPES[Math.floor(rand() * VALID_SCHEMA_ORDER_TYPES.length)];
    const paymentStatus = VALID_SCHEMA_PAYMENT_STATUSES[Math.floor(rand() * VALID_SCHEMA_PAYMENT_STATUSES.length)];
    const paymentMethod = VALID_SCHEMA_PAYMENT_METHODS[Math.floor(rand() * VALID_SCHEMA_PAYMENT_METHODS.length)];
    const paymentProvider = paymentMethod === 'VietQR' ? 'payos' : null;
    const initialStatus = VALID_SCHEMA_ORDER_STATUSES[Math.floor(rand() * VALID_SCHEMA_ORDER_STATUSES.length)];

    const itemCount = 1 + Math.floor(rand() * 3);
    const items = [];
    let orderTotal = 0;

    for (let j = 1; j <= itemCount; j++) {
      const productId = 1 + Math.floor(rand() * 20); // 1..20
      const price = (25 + Math.floor(rand() * 35)) * 1000;
      const quantity = 1 + Math.floor(rand() * 2);
      const lineTotal = price * quantity;
      orderTotal += lineTotal;

      const toppingCount = Math.floor(rand() * 2);
      const toppings = [];
      for (let k = 1; k <= toppingCount; k++) {
        toppings.push({
          topping_id: 1 + Math.floor(rand() * 5),
          topping_name: `Trân Châu #${k}`,
          price: 5000,
        });
      }

      items.push({
        product_id: productId,
        product_name: `Trà Sữa Sample #${productId}`,
        price,
        quantity,
        size_label: 'M',
        base_tea: 'Trà ô long',
        sugar_level: '70%',
        ice_level: '100%',
        toppings,
      });
    }

    const userId = rand() < 0.6 ? 1 + Math.floor(rand() * 100) : null;
    const usesVoucher = rand() < 0.2;
    const voucherCode = usesVoucher ? 'GIAM10' : null;
    const discountAmount = usesVoucher ? Math.round(orderTotal * 0.1) : 0;
    const finalTotal = Math.max(0, orderTotal - discountAmount);

    const sanitizedPrefix = prefix.replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
    const orderCode = `${sanitizedPrefix}${seed % 1000}_${String(i).padStart(6, '0')}`.slice(0, 20);

    orders.push({
      order_code: orderCode,
      store_id: storeId,
      user_id: userId,
      order_type: orderType,
      customer_name: `Khách Hàng #${i}`,
      customer_phone: `090${String(1000000 + (i % 9000000))}`,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      payment_provider: paymentProvider,
      payment_expires_at: paymentStatus === 'unpaid' ? new Date(createdAt.getTime() + 15 * 60000) : null,
      paid_at: paymentStatus === 'paid' ? createdAt : null,
      subtotal: orderTotal,
      discount_amount: discountAmount,
      total: finalTotal,
      voucher_code: voucherCode,
      initial_status: initialStatus,
      created_at: createdAt,
      items,
    });
  }

  return orders;
}

/**
 * Ensures stores, categories, products, toppings, promotions, and users exist.
 */
export async function bootstrapPrerequisiteData(q = db.query) {
  // 1. Stores (1..5)
  for (let s = 1; s <= 5; s++) {
    await q(
      `IF NOT EXISTS (SELECT 1 FROM stores WHERE id = ?)
       BEGIN
         SET IDENTITY_INSERT stores ON;
         INSERT INTO stores (id, name, city, district, address, hours, phone, is_active, created_at)
         VALUES (?, N'Chi nhánh #${s}', N'Hồ Chí Minh', N'Quận 1', N'123 Đường #${s}', N'08:00 - 22:00', '0901234567', 1, GETDATE());
         SET IDENTITY_INSERT stores OFF;
       END`,
      [s, s]
    );
  }

  // 2. Category & Products (1..20)
  await q(
    `IF NOT EXISTS (SELECT 1 FROM categories WHERE id = 1)
     BEGIN
       SET IDENTITY_INSERT categories ON;
       INSERT INTO categories (id, name, slug, sort_order, is_visible, created_at)
       VALUES (1, N'Trà Trái Cây', 'tra-trai-cay', 1, 1, GETDATE());
       SET IDENTITY_INSERT categories OFF;
     END`
  );

  for (let p = 1; p <= 20; p++) {
    await q(
      `IF NOT EXISTS (SELECT 1 FROM products WHERE id = ?)
       BEGIN
         SET IDENTITY_INSERT products ON;
         INSERT INTO products (id, category_id, name, slug, base_tea, price, is_available, created_at)
         VALUES (?, 1, N'Trà Sữa Sample #${p}', 'tra-sua-sample-${p}', N'Trà Đen', 35000, 1, GETDATE());
         SET IDENTITY_INSERT products OFF;
       END`,
      [p, p]
    );
  }

  // 3. Toppings (1..5)
  for (let t = 1; t <= 5; t++) {
    await q(
      `IF NOT EXISTS (SELECT 1 FROM toppings WHERE id = ?)
       BEGIN
         SET IDENTITY_INSERT toppings ON;
         INSERT INTO toppings (id, name, price, is_available, sort_order)
         VALUES (?, N'Trân Châu #${t}', 5000, 1, ${t});
         SET IDENTITY_INSERT toppings OFF;
       END`,
      [t, t]
    );
  }

  // 4. Users (1..100)
  for (let u = 1; u <= 100; u++) {
    const phone = `098${String(1000000 + u)}`;
    const email = `customer_${u}@teaplus.test`;
    await q(
      `IF NOT EXISTS (SELECT 1 FROM users WHERE id = ?)
       BEGIN
         SET IDENTITY_INSERT users ON;
         INSERT INTO users (id, fullname, phone, email, tier, points, total_spent, is_active, created_at)
         VALUES (?, N'Customer #' + CAST(? AS NVARCHAR(10)), ?, ?, N'Đồng', 10, 50000, 1, GETDATE());
         SET IDENTITY_INSERT users OFF;
       END`,
      [u, u, u, phone, email]
    );
  }

  // 5. Promotion 'GIAM10' (id = 1)
  await q(
    `IF NOT EXISTS (SELECT 1 FROM promotions WHERE id = 1)
     BEGIN
       SET IDENTITY_INSERT promotions ON;
       INSERT INTO promotions (id, title, type, code, discount_value, discount_type, voucher_type, start_date, end_date, status, is_active)
       VALUES (1, N'Giảm 10% Test', 'percent', 'GIAM10', 10, 'percent', 'time_bounded', '2026-01-01', '2026-12-31', N'Đang diễn ra', 1);
       SET IDENTITY_INSERT promotions OFF;
     END`
  );
}

/**
 * Cleans up generated performance orders matching prefix and their referencing child records.
 */
export async function cleanupPerformanceDataset({ prefix = 'TP', q = db.query } = {}) {
  const pattern = `${prefix}%`;
  await q('DELETE FROM voucher_usage_history WHERE order_id IN (SELECT id FROM orders WHERE order_code LIKE ?)', [pattern]);
  await q('DELETE FROM order_status_history WHERE order_id IN (SELECT id FROM orders WHERE order_code LIKE ?)', [pattern]);
  await q('DELETE FROM orders WHERE order_code LIKE ?', [pattern]);
}

/**
 * Real transactional database batch seeder pipeline.
 * Inserts generated orders into SQL Server tables in transactional batches.
 */
export async function seedOrdersIntoDatabase(orders, txRunner = db.transaction) {
  if (!Array.isArray(orders) || orders.length === 0) return { insertedOrders: 0 };

  let insertedOrders = 0;
  const chunkSize = 50;

  for (let i = 0; i < orders.length; i += chunkSize) {
    const chunk = orders.slice(i, i + chunkSize);

    await txRunner(async (tx) => {
      for (const order of chunk) {
        const [orderRows] = await tx.query(
          `INSERT INTO orders (order_code, user_id, store_id, order_type, payment_method, payment_status, payment_provider, payment_expires_at, paid_at, customer_name, customer_phone, subtotal, discount_amount, total, voucher_code, created_at, updated_at)
           OUTPUT INSERTED.id
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            order.order_code,
            order.user_id,
            order.store_id,
            order.order_type,
            order.payment_method,
            order.payment_status,
            order.payment_provider,
            order.payment_expires_at,
            order.paid_at,
            order.customer_name,
            order.customer_phone,
            order.subtotal,
            order.discount_amount,
            order.total,
            order.voucher_code,
            order.created_at,
            order.created_at,
          ]
        );
        const orderId = orderRows[0]?.id;

        if (orderId) {
          // Status History
          await tx.query(
            'INSERT INTO order_status_history (order_id, status, created_at) VALUES (?, ?, ?)',
            [orderId, order.initial_status, order.created_at]
          );

          // Voucher Usage History
          if (order.voucher_code) {
            await tx.query(
              'INSERT INTO voucher_usage_history (promotion_id, user_phone, order_id, used_at) VALUES (1, ?, ?, ?)',
              [order.customer_phone, orderId, order.created_at]
            );
          }

          // Items and Toppings
          if (order.items) {
            for (const item of order.items) {
              const [itemRows] = await tx.query(
                `INSERT INTO order_items (order_id, product_id, product_name, qty, size_label, base_tea, sugar_level, ice_level, unit_price, line_total)
                 OUTPUT INSERTED.id
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  orderId,
                  item.product_id,
                  item.product_name,
                  item.quantity,
                  item.size_label,
                  item.base_tea,
                  item.sugar_level,
                  item.ice_level,
                  item.price,
                  item.price * item.quantity,
                ]
              );
              const itemId = itemRows[0]?.id;

              if (itemId && item.toppings) {
                for (const top of item.toppings) {
                  await tx.query(
                    'INSERT INTO order_item_toppings (order_item_id, topping_name, topping_price) VALUES (?, ?, ?)',
                    [itemId, top.topping_name, top.price]
                  );
                }
              }
            }
          }
        }

        insertedOrders++;
      }
    });
  }

  return { insertedOrders };
}

export async function runSeeder({ count = 1000, seed = 42, insertToDb = false, prefix = 'TP', resetPrefix = false } = {}) {
  const args = process.argv.slice(2);
  const confirmArg = args.includes('--confirm') ? '1' : process.env.PERF_SEED_CONFIRM;
  const countArg = args.find((a) => a.startsWith('--orders='))?.split('=')[1];
  const finalCount = countArg ? parseInt(countArg, 10) : count;
  const prefixArg = args.find((a) => a.startsWith('--prefix='))?.split('=')[1] || prefix;
  const shouldResetPrefix = args.includes('--reset-prefix') || resetPrefix;

  validatePerfGuard({ confirmFlag: confirmArg });

  console.log(`🚀 Starting performance seeder: Generating ${finalCount} orders with seed ${seed} (prefix: ${prefixArg})...`);
  const orders = generateDeterministicOrders({ seed, count: finalCount, prefix: prefixArg });
  console.log(`✅ Generated ${orders.length} in-memory records deterministically.`);

  if (insertToDb || args.includes('--insert')) {
    const [existing] = await db.query('SELECT COUNT(id) AS cnt FROM orders WHERE order_code LIKE ?', [`${prefixArg}%`]);
    const existingCount = existing?.[0]?.cnt || 0;

    if (existingCount > 0) {
      if (!shouldResetPrefix) {
        throw new Error(
          `Dataset with prefix "${prefixArg}" already exists (${existingCount} orders found). ` +
          `Run with --reset-prefix to overwrite or specify a different prefix/seed.`
        );
      }
      console.log(`🧹 Resetting existing ${existingCount} orders with prefix "${prefixArg}"...`);
      await cleanupPerformanceDataset({ prefix: prefixArg, q: db.query });
    }

    console.log('🔧 Bootstrapping prerequisite FK data (stores, categories, products, toppings, users)...');
    await bootstrapPrerequisiteData(db.query);
    console.log(`💾 Inserting ${orders.length} orders into SQL Server database in transactional batches...`);
    const { insertedOrders } = await seedOrdersIntoDatabase(orders, db.transaction);
    console.log(`✅ Successfully inserted ${insertedOrders} orders with items, toppings, and status history.`);
  }

  return orders;
}

// Auto-run when executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith('seed-performance-data.js')) {
  runSeeder()
    .then(() => {
      console.log('✅ Seeding completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seeder failed:', err.message);
      process.exit(1);
    });
}

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ALLOWED_DB_PATTERNS = [/test/i, /perf/i, /dev/i, /teaplus_db/i, /teaplus_test/i];

export function validatePerfGuard({ nodeEnv = process.env.NODE_ENV, dbName = process.env.DB_NAME, confirmFlag = process.env.PERF_SEED_CONFIRM } = {}) {
  if (nodeEnv === 'production') {
    throw new Error('GUARDS VIOLATION: Seeding performance data is strictly forbidden in production mode (NODE_ENV=production).');
  }

  const isAllowedDb = ALLOWED_DB_PATTERNS.some((pattern) => pattern.test(String(dbName || '')));
  if (!isAllowedDb) {
    throw new Error(`GUARDS VIOLATION: Database "${dbName}" is not on the test/performance allowlist.`);
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

export function generateDeterministicOrders({ seed = 42, count = 100, days = 90 } = {}) {
  const rand = createPrng(seed);
  const orders = [];
  const now = new Date('2026-08-17T12:00:00.000Z');
  const msPerDay = 86400000;

  const paymentStatuses = ['paid', 'paid', 'paid', 'unpaid', 'expired', 'cancelled'];
  const orderTypes = ['Dine-in', 'Take-away', 'Delivery'];
  const sources = ['online', 'pos'];
  const providers = ['payos', 'manual_vietqr', 'cod'];

  for (let i = 1; i <= count; i++) {
    const dayOffset = rand() * days;
    const createdAt = new Date(now.getTime() - dayOffset * msPerDay);
    const storeId = 1 + Math.floor(rand() * 5);
    const orderType = orderTypes[Math.floor(rand() * orderTypes.length)];
    const source = sources[Math.floor(rand() * sources.length)];
    const paymentStatus = paymentStatuses[Math.floor(rand() * paymentStatuses.length)];
    const paymentProvider = source === 'online' ? 'payos' : providers[Math.floor(rand() * providers.length)];

    const itemCount = 1 + Math.floor(rand() * 4);
    const items = [];
    let orderTotal = 0;

    for (let j = 1; j <= itemCount; j++) {
      const productId = 1 + Math.floor(rand() * 20);
      const price = (20 + Math.floor(rand() * 40)) * 1000;
      const quantity = 1 + Math.floor(rand() * 2);
      const lineTotal = price * quantity;
      orderTotal += lineTotal;

      const toppingCount = Math.floor(rand() * 3);
      const toppings = [];
      for (let k = 1; k <= toppingCount; k++) {
        toppings.push({
          topping_id: 1 + Math.floor(rand() * 5),
          topping_name: `Topping ${k}`,
          price: 5000,
        });
      }

      items.push({
        product_id: productId,
        product_name: `Trà Sữa Sample #${productId}`,
        price,
        quantity,
        toppings,
      });
    }

    const userId = rand() < 0.6 ? 1 + Math.floor(rand() * 100) : null;

    orders.push({
      id: i,
      order_code: `TP${String(i).padStart(6, '0')}`,
      store_id: storeId,
      user_id: userId,
      order_type: orderType,
      source,
      total: orderTotal,
      payment_status: paymentStatus,
      payment_provider: paymentProvider,
      created_at: createdAt,
      items,
    });
  }

  return orders;
}

export async function runSeeder({ count = 1000, seed = 42 } = {}) {
  const args = process.argv.slice(2);
  const confirmArg = args.includes('--confirm') ? '1' : process.env.PERF_SEED_CONFIRM;
  const countArg = args.find((a) => a.startsWith('--orders='))?.split('=')[1];
  const finalCount = countArg ? parseInt(countArg, 10) : count;

  validatePerfGuard({ confirmFlag: confirmArg });

  console.log(`🚀 Starting performance seeder: Generating ${finalCount} orders with seed ${seed}...`);
  const orders = generateDeterministicOrders({ seed, count: finalCount });
  console.log(`✅ Generated ${orders.length} in-memory records deterministically.`);

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

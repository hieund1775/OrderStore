import { expireUnpaidPayOSOrders } from '../services/payment-state.js';
import postgresDb from '../config/db-postgres.js';

try {
  const count = await expireUnpaidPayOSOrders();
  console.log(`PayOS expiry completed: ${count} order(s) expired.`);
  await postgresDb.close();
  process.exit(0);
} catch (error) {
  console.error('PayOS expiry command failed:', error.message);
  await postgresDb.close().catch(() => {});
  process.exit(1);
}

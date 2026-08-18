import { expireUnpaidPayOSOrders } from '../services/payment-state.js';
import postgresDb from '../config/db-postgres.js';
import { fileURLToPath } from 'node:url';

export async function runPayOSExpiryCommand({
  expire = expireUnpaidPayOSOrders,
  close = () => postgresDb.close(),
  logger = console,
  batchSize = Number.parseInt(process.env.PAYOS_EXPIRE_BATCH_SIZE || '100', 10),
} = {}) {
  let failure = null;
  try {
    const count = await expire(batchSize);
    logger.log(`PayOS expiry completed: ${count} order(s) expired.`);
    return count;
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    try {
      await close();
    } catch (closeError) {
      if (failure) throw new AggregateError([failure, closeError], 'PayOS expiry failed and PostgreSQL could not be closed.');
      throw closeError;
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runPayOSExpiryCommand();
    process.exitCode = 0;
  } catch (error) {
    console.error('PayOS expiry command failed:', error?.message || 'unknown error');
    process.exitCode = 1;
  }
}

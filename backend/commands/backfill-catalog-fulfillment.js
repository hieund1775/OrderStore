import postgresDb from '../config/db-postgres.js';
import { runCatalogFulfillmentBackfill } from '../services/catalog/catalog-fulfillment-backfill.js';

const isDryRun = !process.argv.includes('--apply');

console.log(`[BACKFILL] Starting Catalog & Fulfillment Backfill (${isDryRun ? 'DRY-RUN' : 'APPLY'})...`);

try {
  const result = await runCatalogFulfillmentBackfill({ dryRun: isDryRun, database: postgresDb });
  console.log('[BACKFILL RESULT]:', JSON.stringify(result, null, 2));
} catch (err) {
  console.error('[BACKFILL ERROR]:', err);
  process.exit(1);
} finally {
  await postgresDb.close();
}

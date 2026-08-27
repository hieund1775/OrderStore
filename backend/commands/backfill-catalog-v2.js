#!/usr/bin/env node
/**
 * CLI Command: Backfill Catalog V2
 * Usage: node backend/commands/backfill-catalog-v2.js [--dry-run]
 */

import { runCatalogV2Backfill } from '../services/catalog/catalog-v2-backfill.js';

const isDryRun = process.argv.includes('--dry-run');

console.log(`🚀 [Catalog V2 Backfill] Starting ${isDryRun ? '(DRY-RUN MODE)' : '(EXECUTION MODE)'}...`);

runCatalogV2Backfill({ dryRun: isDryRun })
  .then((summary) => {
    console.log('✅ [Catalog V2 Backfill] Completed successfully!');
    console.table(summary);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ [Catalog V2 Backfill] Error:', err);
    process.exit(1);
  });

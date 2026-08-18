import runStagingSmoke from '../test/render-staging-smoke.js';
import postgresDb from '../config/db-postgres.js';

try {
  await runStagingSmoke();
} catch {
  process.exitCode = 1;
} finally {
  await postgresDb.close();
}

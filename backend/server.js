import { PORT, validateEnv } from './config/env.js';
import app from './app.js';
import db from './config/db.js';

// Validate environment policy at startup
try {
  validateEnv();
} catch (err) {
  console.error('❌ [FATAL] Environment Configuration Error:', err.message);
  process.exit(1);
}

const server = app.listen(PORT, () => {
  console.log(`🍵 TeaPlus API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  console.log(`   Liveness:   http://localhost:${PORT}/live`);
  console.log(`   Readiness:  http://localhost:${PORT}/ready`);
  console.log(`   Public API: http://localhost:${PORT}/api`);
});

// ─── Graceful Shutdown Handler ───
let isShuttingDown = false;

async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log('✅ HTTP server closed. Draining database pool...');
    try {
      if (typeof db.close === 'function') {
        await db.close();
      }
      console.log('✅ Database connections closed. Process terminating cleanly.');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during database pool shutdown:', err.message);
      process.exit(1);
    }
  });

  // Force termination if graceful shutdown takes longer than 10 seconds
  setTimeout(() => {
    console.error('⚠️ Graceful shutdown timed out after 10s. Forcefully exiting.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

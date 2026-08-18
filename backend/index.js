import { fileURLToPath } from 'node:url';
import app from './app.js';

// Re-export Express app instance for tests and external runners
export default app;
export { app };

// If executed directly via `node index.js`, delegate to server.js
const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && (process.argv[1] === currentFilePath || process.argv[1].endsWith('index.js'))) {
  import('./server.js');
}
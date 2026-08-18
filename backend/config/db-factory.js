import postgresDb from './db-postgres.js';

/**
 * Resolves active database adapter (PostgreSQL production runtime)
 */
export function getActiveDb() {
  return postgresDb;
}

export default postgresDb;

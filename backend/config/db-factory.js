import postgresDb from './db-postgres.js';
import sqlServerDb from './db.js';

/**
 * Resolves the active database adapter based on DB_DIALECT or DATABASE_URL
 */
export function getActiveDb() {
  const dialect = (process.env.DB_DIALECT || '').toLowerCase();

  if (dialect === 'postgres' || (process.env.DATABASE_URL && dialect !== 'sqlserver')) {
    return postgresDb;
  }

  return sqlServerDb;
}

export default getActiveDb();

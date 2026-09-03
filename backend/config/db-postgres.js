import pg from 'pg';

const { Pool } = pg;

let pool = null;
let mockAdapter = null;

export function isMockAdapterActive() {
  return Boolean(mockAdapter);
}

/**
 * Builds pg.Pool configuration from environment
 */
export function getPostgresPoolConfig(customUrl = null, { env = process.env } = {}) {
  // Tests must never silently prefer an application DATABASE_URL over their
  // explicit dedicated target.
  const connectionString = customUrl || env.TEST_DATABASE_URL || env.DATABASE_URL;

  const config = {
    max: parseInt(env.PG_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(env.PG_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(env.PG_CONNECT_TIMEOUT || '5000', 10),
  };

  if (connectionString) {
    config.connectionString = connectionString;
  } else {
    config.host = env.PGHOST || 'localhost';
    config.port = parseInt(env.PGPORT || '5432', 10);
    config.user = env.PGUSER || 'postgres';
    config.password = env.PGPASSWORD || '';
    config.database = env.PGDATABASE || 'teaplus_dev';
  }

  // SSL Configuration
  const isProduction = env.NODE_ENV === 'production';
  const sslMode = env.PGSSLMODE || env.PG_SSL;

  if (sslMode === 'require' || sslMode === 'true' || isProduction) {
    config.ssl = {
      rejectUnauthorized: env.PG_SSL_REJECT_UNAUTHORIZED !== 'false',
    };
  } else if (sslMode === 'disable' || sslMode === 'false') {
    config.ssl = false;
  }

  return config;
}

/**
 * Returns or initializes singleton pg.Pool
 */
export function getPool(customUrl = null) {
  if (customUrl) {
    return new Pool(getPostgresPoolConfig(customUrl));
  }
  if (!pool) {
    pool = new Pool(getPostgresPoolConfig());
    pool.on('error', (err) => {
      console.error('❌ [PostgreSQL Pool Error]:', err.message);
    });
  }
  return pool;
}

/**
 * PostgreSQL Database Adapter implementing [rows, affectedCount] contract
 */
export const postgresDb = {
  dialect: 'postgres',

  setMockAdapter(mock) {
    mockAdapter = mock;
  },

  resetMockAdapter() {
    mockAdapter = null;
  },

  async query(sqlText, params = []) {
    if (mockAdapter) {
      return mockAdapter.query(sqlText, params);
    }

    const currentPool = getPool();
    const result = await currentPool.query(sqlText, params);
    return [result.rows, result.rowCount ?? 0];
  },

  async transaction(callback) {
    if (mockAdapter && typeof mockAdapter.transaction === 'function') {
      return mockAdapter.transaction(callback);
    }

    const currentPool = getPool();
    const client = await currentPool.connect();

    try {
      await client.query('BEGIN');

      const tx = {
        async query(sqlText, params = []) {
          const res = await client.query(sqlText, params);
          return [res.rows, res.rowCount ?? 0];
        },
      };

      const result = await callback(tx, client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        throw new AggregateError([err, rollbackErr], 'PostgreSQL transaction failed and rollback could not be confirmed.');
      }
      throw err;
    } finally {
      client.release();
    }
  },

  async close() {
    if (pool) {
      await pool.end();
      pool = null;
    }
  },
};

export default postgresDb;

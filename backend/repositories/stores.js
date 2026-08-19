import postgresDb from '../config/db-postgres.js';
import defaultPostgresStoresRepository, { createStoresRepository } from './postgres/stores.js';
import defaultPostgresAdminStoresRepository, { createAdminStoresRepository } from './postgres/admin-stores.js';

export {
  createStoresRepository,
  defaultPostgresStoresRepository as storesRepository,
  createAdminStoresRepository,
  defaultPostgresAdminStoresRepository as adminStoresRepository,
};

export default defaultPostgresStoresRepository;

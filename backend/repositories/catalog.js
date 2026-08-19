import postgresDb from '../config/db-postgres.js';
import defaultPostgresCatalogRepository, { createCatalogRepository } from './postgres/catalog.js';
import defaultPostgresAdminCatalogRepository, { createAdminCatalogRepository } from './postgres/admin-catalog.js';

export {
  createCatalogRepository,
  defaultPostgresCatalogRepository as catalogRepository,
  createAdminCatalogRepository,
  defaultPostgresAdminCatalogRepository as adminCatalogRepository,
};

export default defaultPostgresCatalogRepository;

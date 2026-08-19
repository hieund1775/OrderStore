import postgresDb from '../config/db-postgres.js';
import defaultPostgresAdminInventoryRepository, { createAdminInventoryRepository } from './postgres/admin-inventory.js';

export {
  createAdminInventoryRepository,
  defaultPostgresAdminInventoryRepository as adminInventoryRepository,
};

export default defaultPostgresAdminInventoryRepository;

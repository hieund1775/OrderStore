import postgresDb from '../config/db-postgres.js';
import defaultPostgresAdminManagementRepository, { createAdminManagementRepository } from './postgres/admin-management.js';

export {
  createAdminManagementRepository,
  defaultPostgresAdminManagementRepository as customersRepository,
  defaultPostgresAdminManagementRepository as adminManagementRepository,
};

export default defaultPostgresAdminManagementRepository;

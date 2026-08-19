import postgresDb from '../config/db-postgres.js';
import defaultPostgresAdminReportsRepository, { createAdminReportsRepository } from './postgres/admin-reports.js';

export {
  createAdminReportsRepository,
  defaultPostgresAdminReportsRepository as reportsRepository,
  defaultPostgresAdminReportsRepository as adminReportsRepository,
};

export default defaultPostgresAdminReportsRepository;

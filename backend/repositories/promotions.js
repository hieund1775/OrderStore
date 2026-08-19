import postgresDb from '../config/db-postgres.js';
import defaultPostgresPromotionsRepository, { createPromotionsRepository } from './postgres/promotions.js';
import defaultPostgresAdminPromotionsRepository, { createAdminPromotionsRepository } from './postgres/admin-promotions.js';

export {
  createPromotionsRepository,
  defaultPostgresPromotionsRepository as promotionsRepository,
  createAdminPromotionsRepository,
  defaultPostgresAdminPromotionsRepository as adminPromotionsRepository,
};

export default defaultPostgresPromotionsRepository;

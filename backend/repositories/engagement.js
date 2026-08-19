import postgresDb from '../config/db-postgres.js';
import defaultPostgresEngagementRepository, { createEngagementRepository } from './postgres/engagement.js';

export {
  createEngagementRepository,
  defaultPostgresEngagementRepository as engagementRepository,
};

export default defaultPostgresEngagementRepository;

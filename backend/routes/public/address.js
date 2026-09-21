import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import addressRepository from '../../repositories/postgres/address.js';

export function createPublicAddressRouter(repo = addressRepository) {
  const router = Router();

  /**
   * GET /api/address/streets
   * Query: province, district, q, limit
   */
  router.get('/streets', asyncHandler(async (req, res) => {
    const { province, district, q, limit } = req.query;
    const results = await repo.searchStreets({
      province: typeof province === 'string' ? province : '',
      district: typeof district === 'string' ? district : '',
      query: typeof q === 'string' ? q : '',
      limit: limit ? Number(limit) : 15,
    });
    res.json(results);
  }));

  return router;
}

const defaultRouter = createPublicAddressRouter();
export default defaultRouter;

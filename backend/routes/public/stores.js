import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { toStoreDto, toTableDto } from '../../dto/store-dto.js';
import storeService from '../../services/stores/store-service.js';

const router = Router();

router.get('/stores', asyncHandler(async (req, res) => {
  const rows = await storeService.listActiveStores(req.query);
  res.json(rows.map(toStoreDto));
}));

router.get('/stores/districts', asyncHandler(async (req, res) => {
  const rows = await storeService.listStoreDistricts();
  res.json(rows);
}));

router.get('/table/resolve', asyncHandler(async (req, res) => {
  const { table_id } = req.query;
  if (!table_id) return res.status(400).json({ error: 'Thiếu table_id' });
  const table = await storeService.resolveTable(table_id);
  if (!table) return res.status(404).json({ error: 'Không tìm thấy bàn hoặc bàn đã ngưng hoạt động' });
  res.json({ table: toTableDto(table) });
}));

export default router;

import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { toStoreDto, toTableDto } from '../../dto/store-dto.js';
import storeService from '../../services/stores/store-service.js';
import { hashTableQrToken, TableQrTokenError } from '../../services/table-qr-token.js';

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
  const { table_id: tableId, token } = req.query;
  if (!tableId && !token) return res.status(400).json({ error: 'Thiếu mã QR hoặc table_id' });
  let table;
  if (token) {
    try {
      table = await storeService.resolveTableByCheckoutToken(hashTableQrToken(token));
    } catch (error) {
      if (error instanceof TableQrTokenError) return res.status(error.status).json({ error: error.message });
      throw error;
    }
  } else {
    table = await storeService.resolveTable(tableId);
  }
  if (!table) return res.status(404).json({ error: 'Không tìm thấy bàn hoặc bàn đã ngưng hoạt động' });
  res.json({ table: toTableDto(table) });
}));

export default router;

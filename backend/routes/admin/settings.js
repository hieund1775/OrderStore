import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { toAccountDto, toAuditLogDto } from '../../dto/customer-dto.js';
import customerService from '../../services/customers/customer-service.js';

const router = Router();

router.get('/accounts', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const rows = await customerService.listAccounts();
    res.json(rows.map(toAccountDto));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.get('/audit-logs', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const rows = await customerService.listAuditLogs({ limit: 100 });
    res.json(rows.map(toAuditLogDto));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

export default router;

import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { logAudit } from '../../services/audit.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { validateCustomerNotificationInput } from '../../validation/customer-schemas.js';
import { toNotificationDto } from '../../dto/customer-dto.js';
import customerService from '../../services/customers/customer-service.js';

const router = Router();

router.get('/', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    const rows = await customerService.listNotifications({
      userId: req.user.sub,
      role: req.user.role,
      limit: 50,
    });
    res.json(rows.map(toNotificationDto));
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.post('/', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const validated = validateCustomerNotificationInput(req.body);
    const created = await customerService.createNotification(validated);
    await logAudit(req.user.sub, 'Gửi thông báo', validated.title, req);
    res.status(201).json({ id: created.id, message: 'Đã gửi thông báo' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

export default router;

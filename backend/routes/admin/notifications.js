import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { logAudit } from '../../services/audit.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { validateCustomerNotificationInput } from '../../validation/customer-schemas.js';
import { toNotificationDto } from '../../dto/customer-dto.js';
import notificationService from '../../services/notifications/notification-service.js';

const router = Router();

router.get('/', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    const adminId = Number(req.user?.sub);
    const { notifications, unread_count } = await notificationService.listForUser(adminId, req.query.limit);
    if (req.query.envelope === 'true') {
      return res.json({
        notifications: notifications.map(toNotificationDto),
        unread_count,
      });
    }
    const dtos = notifications.map(toNotificationDto);
    res.json(dtos);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.patch('/:id/read', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    const adminId = Number(req.user?.sub);
    const result = await notificationService.markOneRead(adminId, req.params.id);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.post('/read-all', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    const adminId = Number(req.user?.sub);
    const result = await notificationService.markAllRead(adminId);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.delete('/', requireRole('super', 'manager', 'cashier', 'kitchen'), asyncHandler(async (req, res) => {
  try {
    const adminId = Number(req.user?.sub);
    const result = await notificationService.clearAll(adminId);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

router.post('/', requireRole('super'), asyncHandler(async (req, res) => {
  try {
    const validated = validateCustomerNotificationInput(req.body);
    const created = await notificationService.createManualNotification({
      userId: validated.user_id,
      type: validated.type || 'system',
      title: validated.title,
      body: validated.body,
      link: validated.link,
    });
    await logAudit(req.user.sub, 'Gửi thông báo', validated.title, req);
    res.status(201).json({ id: created.id, message: 'Đã gửi thông báo' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
}));

export default router;

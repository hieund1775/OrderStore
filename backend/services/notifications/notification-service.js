import defaultNotificationsRepository from '../../repositories/postgres/notifications.js';

export class NotificationServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const ALLOWED_TYPES = new Set(['order', 'voucher', 'news', 'stock', 'staff', 'payment', 'system']);

function validateInternalLink(link) {
  if (!link) return null;
  const str = String(link).trim();
  if (!str.startsWith('/') || str.startsWith('//')) {
    throw new NotificationServiceError('Đường dẫn thông báo phải là đường dẫn nội bộ hợp lệ (bắt đầu bằng /)', 400);
  }
  return str;
}

export function createNotificationService(repository = defaultNotificationsRepository) {
  return {
    async listForUser(userId, limit = 50) {
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        throw new NotificationServiceError('ID người dùng không hợp lệ', 400);
      }
      const notifications = await repository.listForUser(parsedUserId, limit);
      const unreadCount = await repository.countUnreadForUser(parsedUserId);
      return { notifications, unread_count: unreadCount };
    },

    async createManualNotification({ userId, type = 'system', title, body, link }) {
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        throw new NotificationServiceError('Người nhận thông báo không hợp lệ', 400);
      }
      if (!ALLOWED_TYPES.has(type)) {
        throw new NotificationServiceError(`Loại thông báo không hợp lệ: ${type}`, 400);
      }
      if (!title || !String(title).trim()) {
        throw new NotificationServiceError('Tiêu đề thông báo không được để trống', 400);
      }
      const safeLink = validateInternalLink(link);

      return repository.insertForUser({
        userId: parsedUserId,
        type,
        title: String(title).trim(),
        body: body ? String(body).trim() : null,
        link: safeLink,
      });
    },

    async markOneRead(userId, notificationId) {
      const parsedUserId = Number(userId);
      const parsedNotifId = Number(notificationId);
      if (!Number.isInteger(parsedUserId) || !Number.isInteger(parsedNotifId)) {
        throw new NotificationServiceError('Tham số không hợp lệ', 400);
      }
      const success = await repository.markOneRead(parsedUserId, parsedNotifId);
      if (!success) {
        throw new NotificationServiceError('Thông báo không tồn tại hoặc không thuộc quyền sở hữu', 404);
      }
      return { ok: true, id: parsedNotifId };
    },

    async markAllRead(userId) {
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        throw new NotificationServiceError('ID người dùng không hợp lệ', 400);
      }
      const affected = await repository.markAllRead(parsedUserId);
      return { ok: true, count: affected };
    },

    async clearAll(userId) {
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        throw new NotificationServiceError('ID người dùng không hợp lệ', 400);
      }
      const affected = await repository.clearAll(parsedUserId);
      return { ok: true, count: affected };
    },
  };
}

export const notificationService = createNotificationService();
export default notificationService;

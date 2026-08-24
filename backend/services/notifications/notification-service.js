import defaultNotificationsRepository from '../../repositories/postgres/notifications.js';

export class NotificationServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const ALLOWED_TYPES = new Set(['order', 'voucher', 'news', 'stock', 'staff', 'payment', 'system']);

function parsePositiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new NotificationServiceError(`${field} không hợp lệ`, 400);
  }
  return parsed;
}

function parseLimit(limit) {
  if (limit === undefined || limit === null || limit === '') return 50;
  const parsed = Number(limit);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new NotificationServiceError('Giới hạn thông báo phải là số nguyên dương', 400);
  }
  return Math.min(parsed, 100);
}

function hasControlCharacters(value) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function validateInternalLink(link) {
  if (!link) return null;
  const str = String(link).trim();
  if (!str.startsWith('/') || str.startsWith('//') || str.includes('\\') || hasControlCharacters(str)) {
    throw new NotificationServiceError('Đường dẫn thông báo phải là đường dẫn nội bộ hợp lệ (bắt đầu bằng /)', 400);
  }
  return str;
}

export function createNotificationService(repository = defaultNotificationsRepository) {
  return {
    async listForUser(userId, limit = 50) {
      const parsedUserId = parsePositiveInteger(userId, 'ID người dùng');
      const parsedLimit = parseLimit(limit);
      const notifications = await repository.listForUser(parsedUserId, parsedLimit);
      const unreadCount = await repository.countUnreadForUser(parsedUserId);
      return { notifications, unread_count: unreadCount };
    },

    async createManualNotification({ userId, type = 'system', title, body, link }) {
      const parsedUserId = parsePositiveInteger(userId, 'Người nhận thông báo');
      if (!ALLOWED_TYPES.has(type)) {
        throw new NotificationServiceError(`Loại thông báo không hợp lệ: ${type}`, 400);
      }
      if (!title || !String(title).trim()) {
        throw new NotificationServiceError('Tiêu đề thông báo không được để trống', 400);
      }
      const normalizedTitle = String(title).trim();
      const normalizedBody = body ? String(body).trim() : null;
      if (normalizedTitle.length > 300) {
        throw new NotificationServiceError('Tiêu đề thông báo không được vượt quá 300 ký tự', 400);
      }
      if (normalizedBody && normalizedBody.length > 5000) {
        throw new NotificationServiceError('Nội dung thông báo không được vượt quá 5000 ký tự', 400);
      }
      const safeLink = validateInternalLink(link);
      if (safeLink && safeLink.length > 500) {
        throw new NotificationServiceError('Đường dẫn thông báo không được vượt quá 500 ký tự', 400);
      }
      const recipient = await repository.findActiveUserById(parsedUserId);
      if (!recipient) {
        throw new NotificationServiceError('Người nhận thông báo không tồn tại hoặc đã ngừng hoạt động', 404);
      }

      return repository.insertForUser({
        userId: parsedUserId,
        type,
        title: normalizedTitle,
        body: normalizedBody,
        link: safeLink,
      });
    },

    async markOneRead(userId, notificationId) {
      const parsedUserId = parsePositiveInteger(userId, 'ID người dùng');
      const parsedNotifId = parsePositiveInteger(notificationId, 'ID thông báo');
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

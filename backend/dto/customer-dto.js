export function toCustomerDto(user) {
  if (!user) return null;
  return {
    id: Number(user.id),
    fullname: user.fullname,
    phone: user.phone,
    email: user.email,
    avatar_url: user.avatar_url || null,
    address: user.address || null,
    tier: user.tier || 'member',
    points: Number(user.points || 0),
    total_spent: Number(user.total_spent || 0),
    is_active: user.is_active !== false,
    created_at: user.created_at,
    total_orders: user.total_orders != null ? Number(user.total_orders) : undefined,
    recent_orders: user.recent_orders || undefined,
  };
}

export function toAccountDto(account) {
  if (!account) return null;
  return {
    id: Number(account.id),
    username: account.username,
    fullname: account.fullname,
    role: account.role,
    branch_id: account.branch_id == null ? null : Number(account.branch_id),
    branch_name: account.branch_name || null,
    is_active: account.is_active !== false,
    last_login: account.last_login || null,
    created_at: account.created_at,
  };
}

export function toAuditLogDto(log) {
  if (!log) return null;
  return {
    id: Number(log.id),
    user_id: Number(log.user_id),
    username: log.username || null,
    action: log.action,
    details: log.details || null,
    ip_address: log.ip_address || null,
    created_at: log.created_at,
  };
}

export function toNotificationDto(notification) {
  if (!notification) return null;
  return {
    id: Number(notification.id),
    user_id: notification.user_id == null ? null : Number(notification.user_id),
    type: notification.type || 'general',
    title: notification.title,
    body: notification.body || null,
    link: notification.link || null,
    is_read: notification.is_read === true,
    created_at: notification.created_at,
  };
}

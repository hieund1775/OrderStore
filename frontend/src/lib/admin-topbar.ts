export function formatAdminRoleLabel(role?: string | null): string {
  switch (role) {
    case "super":
      return "Quản trị viên cấp cao";
    case "manager":
      return "Quản lý chi nhánh";
    case "kitchen":
      return "Bếp / Pha chế";
    case "cashier":
      return "Thu ngân";
    default:
      return "Nhân viên";
  }
}

export function formatNotificationBadgeCount(count?: number | null): string {
  const num = Number(count || 0);
  if (num <= 0) return "";
  if (num > 99) return "99+";
  return String(num);
}

export function getRecentNotifications<T>(notifications: T[] = [], limit: number = 5): T[] {
  if (!Array.isArray(notifications)) return [];
  if (!Number.isFinite(limit) || limit <= 0) return [];
  return notifications.slice(0, Math.floor(limit));
}

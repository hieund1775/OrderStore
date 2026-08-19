export function vnd(amount = 0) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function getOrderStatusLabel(status) {
  switch (status) {
    case 'received':
      return { label: 'Đã nhận đơn', color: '#ea580c', bg: '#ffedd5' };
    case 'preparing':
      return { label: 'Đang pha chế', color: '#d97706', bg: '#fef3c7' };
    case 'ready':
      return { label: 'Đã sẵn sàng', color: '#16a34a', bg: '#dcfce7' };
    case 'delivering':
      return { label: 'Đang giao hàng', color: '#2563eb', bg: '#dbeafe' };
    case 'completed':
      return { label: 'Hoàn thành', color: '#059669', bg: '#d1fae5' };
    case 'cancelled':
      return { label: 'Đã hủy', color: '#dc2626', bg: '#fee2e2' };
    default:
      return { label: status, color: '#6b7280', bg: '#f3f4f6' };
  }
}

export function getTierBadge(tier) {
  switch (tier) {
    case 'diamond':
      return { label: 'Kim Cương', color: '#7c3aed', bg: '#ede9fe' };
    case 'gold':
      return { label: 'Vàng', color: '#d97706', bg: '#fef3c7' };
    case 'silver':
      return { label: 'Bạc', color: '#4b5563', bg: '#f3f4f6' };
    default:
      return { label: 'Thành viên', color: '#ea580c', bg: '#ffedd5' };
  }
}

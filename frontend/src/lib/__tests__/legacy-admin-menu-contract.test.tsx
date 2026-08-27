import { describe, it, expect } from 'vitest';
import { formatAdminRoleLabel } from '../admin-topbar';

describe('Legacy Admin Menu & RBAC Contract Suite', () => {
  it('formats valid role labels for legacy staff and admin hierarchy', () => {
    expect(formatAdminRoleLabel('super')).toBe('Quản trị viên cấp cao');
    expect(formatAdminRoleLabel('manager')).toBe('Quản lý chi nhánh');
    expect(formatAdminRoleLabel('cashier')).toBe('Thu ngân');
    expect(formatAdminRoleLabel('kitchen')).toBe('Bếp / Pha chế');
    expect(formatAdminRoleLabel('packing')).toBe('Soạn hàng / Đóng gói');
    expect(formatAdminRoleLabel('unknown')).toBe('Nhân viên');
  });
});

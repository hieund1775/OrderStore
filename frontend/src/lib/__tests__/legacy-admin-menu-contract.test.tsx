import { describe, it, expect } from 'vitest';
import { formatAdminRoleLabel } from '../admin-topbar';
import { adminNav } from '@/components/admin/AdminSidebar';

describe('Legacy Admin Menu & RBAC Contract Suite', () => {
  it('formats valid role labels for legacy staff and admin hierarchy', () => {
    expect(formatAdminRoleLabel('super')).toBe('Quản trị viên cấp cao');
    expect(formatAdminRoleLabel('manager')).toBe('Quản lý chi nhánh');
    expect(formatAdminRoleLabel('cashier')).toBe('Thu ngân');
    expect(formatAdminRoleLabel('kitchen')).toBe('Bếp / Pha chế');
    expect(formatAdminRoleLabel('packing')).toBe('Soạn hàng / Đóng gói');
    expect(formatAdminRoleLabel('unknown')).toBe('Nhân viên');
  });

  it('Legacy menu route /admin/thuc-don exists in compatibility window', async () => {
    const routeModule = await import('@/routes/admin.thuc-don');
    expect(routeModule.Route).toBeDefined();
  });

  it('Admin sidebar has removed legacy menu item in favor of unified Catalog', () => {
    const legacyItem = adminNav.find((item) => item.to === '/admin/thuc-don');
    expect(legacyItem).toBeUndefined();

    const catalogItem = adminNav.find((item) => item.to === '/admin/catalog');
    expect(catalogItem).toBeDefined();
    expect(catalogItem?.label).toContain('Sản phẩm & Danh mục');
  });
});
